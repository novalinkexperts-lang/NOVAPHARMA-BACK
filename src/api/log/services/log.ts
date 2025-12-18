/**
 * log service
 */

import { factories } from '@strapi/strapi';

const APP_SETTING_MODULE_REFS = ['api::app-setting.app-setting'];
const USER_MODULE_REFS = ['plugin::users-permissions.user', 'users', 'user'];

const toSafeJSON = (payload: unknown) => JSON.parse(JSON.stringify(payload ?? null));

const resolveIpAddress = (ctx: any) => {
    const forwarded = ctx.request?.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }

    return ctx.request?.ip || ctx.ip || undefined;
};

const resolveUserDocumentId = (ctx: any) => ctx.state?.user?.documentId || ctx.state?.user?.id || null;

const resolveModule = async (strapi: any, refs: string[]) => {
    for (const ref of refs) {
        try {
            const modules = await strapi.documents('api::module.module')
                .findMany({
                    filters: { ref: { $eq: ref } },
                });

            if (modules && modules.length > 0) {
                return modules[0];
            }
        } catch (error) {
            strapi.log.warn(`Unable to resolve module "${ref}" for app-setting logs`, error);
        }
    }

    return null;
};

export default factories.createCoreService('api::log.log', ({ strapi }) => ({
    /**
     * Record an app-setting action into the logs collection.
     */
    async recordAppSettingLog(
        ctx: any,
        options: { action: 'create' | 'update'; details: string; dataBefore?: unknown; dataAfter?: unknown; }
    ) {
        const { action, details, dataBefore, dataAfter } = options;
        const module = await resolveModule(strapi, APP_SETTING_MODULE_REFS);
        const userDocumentId = resolveUserDocumentId(ctx);
        console.log("ctx.state?.user", ctx.state);
        console.log("userDocumentId", userDocumentId);
        const logData: any = {
            date: new Date(),
            action,
            details,
            dataBefore: toSafeJSON(dataBefore),
            dataAfter: toSafeJSON(dataAfter),
            ipAdress: resolveIpAddress(ctx),
            localisation: ctx.request?.headers?.['accept-language'],
        };

        if (module?.documentId) {
            logData.module = module.documentId;
        }

        if (userDocumentId) {
            logData.user = userDocumentId;
        }

        const logEntry = await strapi.documents('api::log.log')
            .create({
                data: logData,
            });

        await strapi.documents('api::log.log')
            .publish({
                documentId: logEntry.documentId,
            });

        return logEntry;
    },

    /**
     * Record a users-permissions action into the logs collection.
     */
    async recordUserLog(
        ctx: any,
        options: { action: 'create' | 'update'; details: string; dataBefore?: unknown; dataAfter?: unknown; }
    ) {
        const { action, details, dataBefore, dataAfter } = options;
        const module = await resolveModule(strapi, USER_MODULE_REFS);
        const userDocumentId = resolveUserDocumentId(ctx);
        console.log("ctx.state?.user", ctx.state);
        console.log("userDocumentId", userDocumentId);
        console.log("module", module);
        const logData: any = {
            date: new Date(),
            action,
            details,
            dataBefore: toSafeJSON(dataBefore),
            dataAfter: toSafeJSON(dataAfter),
            ipAdress: resolveIpAddress(ctx),
            localisation: ctx.request?.headers?.['accept-language'],
        };
        console.log("logData", logData);
        if (module?.documentId) {
            logData.module = module.documentId;
        }

        if (userDocumentId) {
            logData.user = userDocumentId;
        }

        const logEntry = await strapi.documents('api::log.log')
            .create({
                data: logData,
            });

        await strapi.documents('api::log.log')
            .publish({
                documentId: logEntry.documentId,
            });

        return logEntry;
    },
}));
