/**
 * backup service
 */

import { factories } from '@strapi/strapi';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const copyFile = promisify(fs.copyFile);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

// Stockage en mémoire pour le suivi de progression
const progressStore = new Map<string, { progress: number; status: 'running' | 'completed' | 'failed'; error?: string }>();

export default factories.createCoreService('api::backup.backup', ({ strapi }) => ({
    /**
     * Crée un backup de la base de données
     * @param options Options de backup (type, backupType, backupId)
     * @returns L'entrée backup créée avec le backupId
     */
    async createBackup(options: { type?: 'auto' | 'manual'; backupType?: 'complete' | 'incremental'; backupId?: string } = {}) {
        const { type = 'manual', backupType = 'complete', backupId: providedBackupId } = options;
        const backupId = providedBackupId || `backup_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        try {
            // Initialiser la progression
            progressStore.set(backupId, { progress: 0, status: 'running' });

            // Récupérer la configuration de la base de données
            const dbConfig = strapi.config.get('database.connection') as any;
            const client = dbConfig?.client || 'sqlite';

            let backupPath: string;
            let filename: string;
            let fileSize: number;

            if (client === 'sqlite') {
                // Pour SQLite, copier le fichier de base de données
                let dbPath = dbConfig?.connection?.filename;

                if (!dbPath) {
                    throw new Error('SQLite database filename not found in configuration');
                }

                // Gérer les chemins relatifs
                if (!path.isAbsolute(dbPath)) {
                    dbPath = path.resolve(process.cwd(), dbPath);
                }

                const dbName = path.basename(dbPath, path.extname(dbPath));
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                filename = `${dbName}_backup_${timestamp}.db`;

                const backupsDir = path.join(process.cwd(), 'backups');
                if (!fs.existsSync(backupsDir)) {
                    await mkdir(backupsDir, { recursive: true });
                }

                backupPath = path.join(backupsDir, filename);

                // Mise à jour de la progression (20%)
                progressStore.set(backupId, { progress: 20, status: 'running' });

                // Vérifier que le fichier de base de données existe
                if (!fs.existsSync(dbPath)) {
                    throw new Error(`Database file not found: ${dbPath}`);
                }

                // Copier le fichier de base de données
                await copyFile(dbPath, backupPath);

                // Mise à jour de la progression (60%)
                progressStore.set(backupId, { progress: 60, status: 'running' });

                // Obtenir la taille du fichier
                const stats = await stat(backupPath);
                fileSize = stats.size;

            } else if (client === 'postgres' || client === 'mysql') {
                // Pour PostgreSQL/MySQL, on pourrait utiliser pg_dump ou mysqldump
                // Pour l'instant, on crée juste une entrée de backup
                // TODO: Implémenter le dump SQL pour PostgreSQL/MySQL
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                filename = `backup_${timestamp}.sql`;

                const backupsDir = path.join(process.cwd(), 'backups');
                if (!fs.existsSync(backupsDir)) {
                    await mkdir(backupsDir, { recursive: true });
                }

                backupPath = path.join(backupsDir, filename);

                // Pour l'instant, on crée un fichier vide (à implémenter avec pg_dump/mysqldump)
                fs.writeFileSync(backupPath, '-- Backup file\n-- TODO: Implement SQL dump');
                const stats = await stat(backupPath);
                fileSize = stats.size;

                progressStore.set(backupId, { progress: 60, status: 'running' });
            } else {
                throw new Error(`Database client ${client} not supported for backup`);
            }

            // Mise à jour de la progression (80%)
            progressStore.set(backupId, { progress: 80, status: 'running' });

            // Créer l'entrée dans la collection backup
            const backupData = {
                date: new Date(),
                type,
                backupType,
                size: fileSize,
                state: 'success' as const,
                location: 'local' as const,
                filename,
            };

            const backupEntry = await strapi.documents('api::backup.backup')
                .create({
                    data: backupData,
                });

            const publishedBackup = await strapi.documents('api::backup.backup')
                .publish({
                    documentId: backupEntry.documentId,
                });

            // Mise à jour de la progression (100%)
            progressStore.set(backupId, { progress: 100, status: 'completed' });

            // Nettoyer la progression après 5 minutes
            setTimeout(() => {
                progressStore.delete(backupId);
            }, 5 * 60 * 1000);

            return {
                ...publishedBackup,
                backupId, // Ajouter le backupId pour le suivi
            };
        } catch (error: any) {
            // Marquer comme échoué
            progressStore.set(backupId, {
                progress: 0,
                status: 'failed',
                error: error.message || 'Unknown error'
            });

            // Créer une entrée de backup avec l'état failed
            try {
                const backupData = {
                    date: new Date(),
                    type,
                    backupType,
                    size: 0,
                    state: 'failed' as const,
                    location: 'local' as const,
                    filename: '',
                    error: error.message || 'Unknown error',
                };

                await strapi.documents('api::backup.backup')
                    .create({
                        data: backupData,
                    });
            } catch (createError) {
                strapi.log.error('Error creating failed backup entry:', createError);
            }

            throw error;
        }
    },

    /**
     * Restaure un backup existant
     * @param backupId L'ID du backup à restaurer
     */
    async restoreBackup(backupId: string) {
        try {
            // Récupérer le backup
            const backup = await strapi.documents('api::backup.backup')
                .findOne({
                    documentId: backupId,
                });

            if (!backup) {
                throw new Error('Backup not found');
            }

            if (backup.state !== 'success') {
                throw new Error('Cannot restore a failed backup');
            }

            if (!backup.filename) {
                throw new Error('Backup filename is missing');
            }

            // Récupérer la configuration de la base de données
            const dbConfig = strapi.config.get('database.connection') as any;
            const client = dbConfig?.client || 'sqlite';

            if (client === 'sqlite') {
                const backupsDir = path.join(process.cwd(), 'backups');
                const backupPath = path.join(backupsDir, backup.filename);
                let dbPath = dbConfig?.connection?.filename;

                if (!dbPath) {
                    throw new Error('SQLite database filename not found in configuration');
                }

                // Gérer les chemins relatifs
                if (!path.isAbsolute(dbPath)) {
                    dbPath = path.resolve(process.cwd(), dbPath);
                }

                // Vérifier que le fichier de backup existe
                if (!fs.existsSync(backupPath)) {
                    throw new Error(`Backup file not found: ${backupPath}`);
                }

                // Créer un backup de sécurité avant la restauration
                const dbName = path.basename(dbPath, path.extname(dbPath));
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const safetyBackupPath = path.join(backupsDir, `${dbName}_safety_${timestamp}.db`);

                // Vérifier que le fichier de base de données existe
                if (!fs.existsSync(dbPath)) {
                    throw new Error(`Database file not found: ${dbPath}`);
                }

                // Copier la base actuelle comme backup de sécurité
                await copyFile(dbPath, safetyBackupPath);

                // ATTENTION: La restauration nécessite de fermer la connexion à la base de données
                // Cela peut causer des problèmes si d'autres requêtes sont en cours
                // Il est recommandé de redémarrer Strapi après une restauration
                strapi.log.warn('Closing database connection for restore. Strapi may need to be restarted after restore.');

                try {
                    // Fermer toutes les connexions à la base de données
                    if (strapi.db.connection && typeof strapi.db.connection.destroy === 'function') {
                        await strapi.db.connection.destroy();
                    }

                    // Copier le backup sur la base de données
                    await copyFile(backupPath, dbPath);

                    // Note: La reconnexion peut ne pas fonctionner correctement
                    // Il est recommandé de redémarrer Strapi après une restauration
                    strapi.log.warn('Database restored. Please restart Strapi to ensure proper connection.');
                } catch (restoreError: any) {
                    strapi.log.error('Error during restore operation:', restoreError);
                    // Essayer de restaurer le backup de sécurité
                    try {
                        await copyFile(safetyBackupPath, dbPath);
                        strapi.log.info('Safety backup restored due to restore error');
                    } catch (safetyError) {
                        strapi.log.error('CRITICAL: Could not restore safety backup:', safetyError);
                    }
                    throw restoreError;
                }

                return {
                    success: true,
                    message: 'Backup restored successfully',
                    safetyBackup: path.basename(safetyBackupPath),
                };
            } else if (client === 'postgres' || client === 'mysql') {
                // TODO: Implémenter la restauration pour PostgreSQL/MySQL
                throw new Error(`Restore for ${client} is not yet implemented`);
            } else {
                throw new Error(`Database client ${client} not supported for restore`);
            }
        } catch (error: any) {
            strapi.log.error('Error restoring backup:', error);
            throw error;
        }
    },

    /**
     * Récupère la progression d'un backup en cours
     * @param backupId L'ID du backup
     * @returns L'état de progression
     */
    getBackupProgress(backupId: string) {
        const progress = progressStore.get(backupId);
        if (!progress) {
            return { progress: 0, status: 'not_found' };
        }
        return progress;
    },

    /**
     * Liste tous les fichiers de backup disponibles
     */
    async listBackupFiles() {
        const backupsDir = path.join(process.cwd(), 'backups');
        if (!fs.existsSync(backupsDir)) {
            return [];
        }

        const files = await readdir(backupsDir);
        const backupFiles = [];

        for (const file of files) {
            const filePath = path.join(backupsDir, file);
            const stats = await stat(filePath);
            backupFiles.push({
                filename: file,
                size: stats.size,
                createdAt: stats.birthtime,
                modifiedAt: stats.mtime,
            });
        }

        return backupFiles.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },

    /**
     * Supprime un fichier de backup
     * @param filename Le nom du fichier à supprimer
     */
    async deleteBackupFile(filename: string) {
        const backupsDir = path.join(process.cwd(), 'backups');
        const backupPath = path.join(backupsDir, filename);

        if (!fs.existsSync(backupPath)) {
            throw new Error('Backup file not found');
        }

        await unlink(backupPath);
        return { success: true, message: 'Backup file deleted' };
    },
}));
