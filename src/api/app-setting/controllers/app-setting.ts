/**
 * app-setting controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::app-setting.app-setting', ({ strapi }) => ({
    async hello(ctx) {
        return "hi";
    },

    /**
     * GET /app-settings/default
     * Retourne l'unique entrée dont isDefault = true
     * Retourne null si aucune entrée n'est marquée comme défaut
     */
    async getDefault(ctx) {
        try {
            const results = await strapi.documents('api::app-setting.app-setting')
                .findMany({
                    filters: { isDefault: { $eq: true } },
                    populate: '*',
                });

            const defaultSetting = results.length > 0 ? results[0] : null;

            if (!defaultSetting) {
                return ctx.send({ data: null }, 200);
            }

            return ctx.send({ data: defaultSetting }, 200);
        } catch (error) {
            strapi.log.error('Error fetching default app setting:', error);
            return ctx.internalServerError('Error fetching default app setting');
        }
    },

    /**
     * POST /app-settings/default
     * Crée le paramètre par défaut
     * Refuse la création si une entrée par défaut existe déjà
     */
    async createDefault(ctx) {
        try {
            // Vérifier si un paramètre par défaut existe déjà
            const existingDefaults = await strapi.documents('api::app-setting.app-setting')
                .findMany({
                    filters: { isDefault: { $eq: true } },
                });

            if (existingDefaults.length > 0) {
                return ctx.badRequest('A default app setting already exists. Use PUT to update it instead.');
            }

            // Récupérer les données de la requête
            const { data } = ctx.request.body;

            // S'assurer que isDefault est défini à true
            const settingData = {
                ...data,
                isDefault: true,
            };

            // Créer l'entrée
            const newSetting = await strapi.documents('api::app-setting.app-setting')
                .create({
                    data: settingData,
                });

            await strapi.documents('api::app-setting.app-setting')
                .publish({
                    documentId: newSetting.documentId,
                });

            return ctx.send({ data: newSetting }, 201);
        } catch (error) {
            strapi.log.error('Error creating default app setting:', error);
            return ctx.internalServerError('Error creating default app setting');
        }
    },

    /**
     * PUT /app-settings/default
     * Met à jour le paramètre par défaut existant
     */
    async updateDefault(ctx) {
        try {
            // Trouver l'entrée avec isDefault = true
            const existingDefaults = await strapi.documents('api::app-setting.app-setting')
                .findMany({
                    filters: { isDefault: { $eq: true } },
                });

            if (existingDefaults.length === 0) {
                return ctx.notFound('No default app setting found. Use POST to create one first.');
            }

            const existingDefault = existingDefaults[0];

            // Récupérer les données de la requête
            const { data } = ctx.request.body;

            // S'assurer que isDefault reste à true
            const updateData = {
                ...data,
                isDefault: true,
            };

            // Mettre à jour l'entrée
            const updatedSetting = await strapi.documents('api::app-setting.app-setting')
                .update({
                    documentId: existingDefault.documentId,
                    data: updateData,
                });

            await strapi.documents('api::app-setting.app-setting')
                .publish({
                    documentId: updatedSetting.documentId,
                });

            return ctx.send({ data: updatedSetting }, 200);
        } catch (error) {
            strapi.log.error('Error updating default app setting:', error);
            return ctx.internalServerError('Error updating default app setting');
        }
    },
}));
