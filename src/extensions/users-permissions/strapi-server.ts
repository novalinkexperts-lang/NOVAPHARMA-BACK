import type { Core } from '@strapi/strapi';

export default (plugin: Core.Plugin) => {
    // Store the original methods
    const originalFind = plugin.controllers.user.find;
    const originalUpdate = plugin.controllers.user.update;
    const originalCreate = plugin.controllers.user.create;
    const originalDelete = plugin.controllers.user.destroy;

    // Override the find method to support documentId
    plugin.controllers.user.find = async (ctx: any) => {
        const { id } = ctx.params;

        // If no id in params, it's a list query - use original behavior
        if (!id) {
            console.log('[FIND] Case: LIST QUERY - No ID in params, using original find behavior');
            console.log('[FIND] Query params:', JSON.stringify(ctx.query, null, 2));
            return originalFind(ctx, null);
        }

        // Check if id is a documentId (UUID-like format) or numeric ID
        // DocumentId format: typically longer alphanumeric string (e.g., wvxbby7r1uci1gh8z1m2lzav)
        // Numeric ID: simple number
        const isDocumentId = isNaN(Number(id)) || id.length > 10;

        console.log(`[FIND] Case: SINGLE USER - ID: ${id}`);
        console.log(`[FIND] Is DocumentId: ${isDocumentId} (isNaN: ${isNaN(Number(id))}, length: ${id.length})`);

        if (isDocumentId) {
            // Use documentId to find the user
            console.log('[FIND] Using DOCUMENTID path');
            try {
                // Parse all query parameters
                const parseQueryParam = (param: any) => {
                    if (!param) return undefined;
                    if (typeof param === 'string') {
                        try {
                            return JSON.parse(param);
                        } catch {
                            return param;
                        }
                    }
                    return param;
                };

                // Build query options from query string
                const populate = parseQueryParam(ctx.query?.populate) || {};
                const filters = parseQueryParam(ctx.query?.filters);
                const sort = parseQueryParam(ctx.query?.sort);
                const fields = parseQueryParam(ctx.query?.fields);
                const locale = ctx.query?.locale;

                console.log('[FIND] Query parameters parsed:');
                console.log('  - populate:', JSON.stringify(populate, null, 2));
                console.log('  - filters:', JSON.stringify(filters, null, 2));
                console.log('  - sort:', JSON.stringify(sort, null, 2));
                console.log('  - fields:', JSON.stringify(fields, null, 2));
                console.log('  - locale:', locale);

                // Build the findOne options
                const findOptions: any = {
                    documentId: id
                };

                if (Object.keys(populate).length > 0) {
                    findOptions.populate = populate;
                }

                if (filters) {
                    findOptions.filters = filters;
                }

                if (sort) {
                    findOptions.sort = sort;
                }

                if (fields) {
                    findOptions.fields = fields;
                }

                if (locale) {
                    findOptions.locale = locale;
                }

                console.log('[FIND] Find options:', JSON.stringify(findOptions, null, 2));

                const user = await strapi.documents('plugin::users-permissions.user')
                    .findOne(findOptions);

                if (!user) {
                    console.log('[FIND] User not found with documentId:', id);
                    return ctx.notFound('User not found');
                }

                console.log('[FIND] User found successfully by documentId:', id);
                strapi.log.info(`Found user by documentId: ${id}`);
                return { data: user };
            } catch (error) {
                strapi.log.error('Error finding user by documentId:', error);
                const errorMessage = error instanceof Error ? error.message : 'Error finding user';
                return ctx.internalServerError({
                    message: errorMessage,
                    error: process.env.NODE_ENV === 'development' ? { originalError: error } : undefined
                });
            }
        } else {
            // Numeric ID - use original behavior
            console.log('[FIND] Using NUMERIC ID path - delegating to original find');
            console.log('[FIND] Numeric ID:', id);
            console.log('[FIND] Query params:', JSON.stringify(ctx.query, null, 2));
            return originalFind(ctx, null);
        }
    };

    // Override the update method
    plugin.controllers.user.update = async (ctx: any) => {
        // Get documentId from params (you're sending documentId instead of id)
        const { id } = ctx.params;
        const { data } = ctx.request.body;
        console.log("yonda ka ?", data);

        if (!id) {
            return ctx.badRequest('documentId is required');
        }

        // Find the user by documentId to get the actual id
        let userId: number | string;

        try {
            // In Strapi v5, find user by documentId
            const user = await strapi.documents('plugin::users-permissions.user')
                .findOne({ documentId: id });

            if (!user) {
                return ctx.notFound('User not found');
            }

            userId = user.id;
        } catch (error) {
            strapi.log.error('Error finding user by documentId:', error);
            return ctx.internalServerError('Error finding user');
        }

        // Update ctx.params to use id instead of documentId for the original method
        ctx.params.id = userId;

        strapi.log.info(`Updating user with documentId: ${id}, id: ${userId}`);

        // // Example: Hash password if provided
        // if (data?.password) {
        //     data.password = await strapi
        //         .plugin('users-permissions')
        //         .service('user')
        //         .hashPassword(data.password);
        // }

        // // Example: Add custom validation
        // if (data?.email) {
        //     const existingUser = await strapi.db
        //         .query('plugin::users-permissions.user')
        //         .findOne({ where: { email: data.email } });

        //     if (existingUser && existingUser.id !== Number(userId)) {
        //         return ctx.badRequest('Email already exists');
        //     }
        // }

        // Call the original update method (it will now use ctx.params.id)
        const result = await strapi.documents('plugin::users-permissions.user')
            .update({
                documentId: id,
                data: data
            });

        // const result = await originalUpdate(ctx);

        // Add your custom logic here after the update
        strapi.log.info(`User with documentId ${id} updated successfully`);

        return result;
    };

    // Override the create method to assign default authenticated role
    plugin.controllers.user.create = async (ctx: any) => {
        const { data } = ctx.request.body;
        console.log("yonda ka ?", data);

        try {
            // Get the default authenticated role
            const roles = await strapi
                .documents('plugin::users-permissions.role')
                .findMany({ filters: { type: 'authenticated' } });

            const authenticatedRole = roles?.[0];

            if (!authenticatedRole) {
                strapi.log.error('Authenticated role not found');
                return ctx.internalServerError('Authenticated role not found');
            }

            // Assign the authenticated role if no role is provided
            if (!data.role) {
                data.role = authenticatedRole.documentId;
            }

            strapi.log.info(`Creating user with role: ${data.role || authenticatedRole.documentId}`);

            // Call the original create method
            // const result = await originalCreate(ctx);

            const result = await strapi.documents('plugin::users-permissions.user')
                .create({
                    data: data
                });

            strapi.log.info('User created successfully with authenticated role');
            return result;
        } catch (error) {
            console.log(error.details);
            strapi.log.error('Error creating user:', error);
            return ctx.internalServerError('Error creating user');
        }
    };

    // Override the delete method
    plugin.controllers.user.destroy = async (ctx: any) => {
        // Get documentId from params (you're sending documentId instead of id)
        const { id } = ctx.params;
        console.log("yonda ka ? delete", id);

        if (!id) {
            return ctx.badRequest('documentId is required');
        }

        try {
            // In Strapi v5, find user by documentId to verify it exists
            const user = await strapi.documents('plugin::users-permissions.user')
                .findOne({ documentId: id });

            if (!user) {
                return ctx.notFound('User not found');
            }

            strapi.log.info(`Deleting user with documentId: ${id}, id: ${user.id}`);

            // Delete the user using documentId
            const result = await strapi.documents('plugin::users-permissions.user')
                .delete({ documentId: id });

            strapi.log.info(`User with documentId ${id} deleted successfully`);
            return result;
        } catch (error) {
            strapi.log.error('Error deleting user:', error);
            const errorMessage = error instanceof Error ? error.message : 'Error deleting user';
            return ctx.internalServerError({
                message: errorMessage,
                error: process.env.NODE_ENV === 'development' ? { originalError: error } : undefined
            });
        }
    };

    return plugin;
};

