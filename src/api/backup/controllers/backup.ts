/**
 * backup controller
 */

import { factories } from '@strapi/strapi';
import * as fs from 'fs';

export default factories.createCoreController('api::backup.backup', ({ strapi }) => {
    const backupService = strapi.service('api::backup.backup');

    return {
        /**
         * POST /backups/create
         * Crée un nouveau backup de la base de données (asynchrone)
         */
        async create(ctx) {
            try {
                const { type = 'manual', backupType = 'complete' } = ctx.request.body;

                // Générer un ID unique pour le suivi
                const backupId = `backup_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                // Démarrer le backup en arrière-plan
                backupService.createBackup({ type, backupType, backupId })
                    .then((backup) => {
                        strapi.log.info(`Backup created successfully: ${backup.documentId} (backupId: ${backupId})`);
                    })
                    .catch((error) => {
                        strapi.log.error(`Error creating backup (backupId: ${backupId}):`, error);
                    });

                // Retourner immédiatement avec l'ID de suivi
                return ctx.send({
                    success: true,
                    message: 'Backup creation started',
                    backupId,
                }, 202); // 202 Accepted - traitement asynchrone
            } catch (error: any) {
                strapi.log.error('Error starting backup:', error);
                return ctx.internalServerError(error.message || 'Error starting backup');
            }
        },

        /**
         * POST /backups/create-sync
         * Crée un backup de manière synchrone (attente de la fin)
         */
        async createSync(ctx) {
            try {
                const { type = 'manual', backupType = 'complete' } = ctx.request.body;

                const backup = await backupService.createBackup({ type, backupType });

                return ctx.send({
                    success: true,
                    data: backup,
                }, 201);
            } catch (error: any) {
                strapi.log.error('Error creating backup:', error);
                return ctx.internalServerError(error.message || 'Error creating backup');
            }
        },

        /**
         * GET /backups/:backupId/progress
         * Récupère la progression d'un backup en cours
         */
        async getProgress(ctx) {
            try {
                const { backupId } = ctx.params;

                if (!backupId) {
                    return ctx.badRequest('backupId is required');
                }

                const progress = backupService.getBackupProgress(backupId);

                return ctx.send({
                    success: true,
                    data: progress,
                });
            } catch (error: any) {
                strapi.log.error('Error getting backup progress:', error);
                return ctx.internalServerError(error.message || 'Error getting backup progress');
            }
        },

        /**
         * POST /backups/:backupId/restore
         * Restaure un backup existant
         */
        async restore(ctx) {
            try {
                const { backupId } = ctx.params;

                if (!backupId) {
                    return ctx.badRequest('backupId is required');
                }

                // Vérifier que l'utilisateur a les permissions nécessaires
                // (vous pouvez ajouter une vérification de permissions ici)

                const result = await backupService.restoreBackup(backupId);

                return ctx.send({
                    success: true,
                    data: result,
                });
            } catch (error: any) {
                strapi.log.error('Error restoring backup:', error);

                if (error.message.includes('not found')) {
                    return ctx.notFound(error.message);
                }

                return ctx.internalServerError(error.message || 'Error restoring backup');
            }
        },

        /**
         * GET /backups/files
         * Liste tous les fichiers de backup disponibles
         */
        async listFiles(ctx) {
            try {
                const files = await backupService.listBackupFiles();

                return ctx.send({
                    success: true,
                    data: files,
                });
            } catch (error: any) {
                strapi.log.error('Error listing backup files:', error);
                return ctx.internalServerError(error.message || 'Error listing backup files');
            }
        },

        /**
         * DELETE /backups/files/:filename
         * Supprime un fichier de backup
         */
        async deleteFile(ctx) {
            try {
                const { filename } = ctx.params;

                if (!filename) {
                    return ctx.badRequest('filename is required');
                }

                const result = await backupService.deleteBackupFile(filename);

                return ctx.send({
                    success: true,
                    data: result,
                });
            } catch (error: any) {
                strapi.log.error('Error deleting backup file:', error);

                if (error.message.includes('not found')) {
                    return ctx.notFound(error.message);
                }

                return ctx.internalServerError(error.message || 'Error deleting backup file');
            }
        },

        /**
         * GET /backups/files/:filename/download
         * Télécharge un fichier de backup
         */
        async downloadFile(ctx) {
            try {
                const { filename } = ctx.params;

                if (!filename) {
                    return ctx.badRequest('filename is required');
                }

                // Récupérer le chemin du fichier
                const filePath = backupService.getBackupFilePath(filename);

                // Obtenir les stats du fichier pour l'en-tête Content-Length
                const stats = await fs.promises.stat(filePath);

                // Définir les en-têtes pour le téléchargement
                ctx.set('Content-Type', 'application/octet-stream');
                ctx.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
                ctx.set('Content-Length', stats.size.toString());

                // Envoyer le fichier en tant que stream
                ctx.body = fs.createReadStream(filePath);
            } catch (error: any) {
                strapi.log.error('Error downloading backup file:', error);

                if (error.message.includes('not found') || error.message.includes('Invalid')) {
                    return ctx.notFound(error.message || 'Backup file not found');
                }

                return ctx.internalServerError(error.message || 'Error downloading backup file');
            }
        },
    };
});
