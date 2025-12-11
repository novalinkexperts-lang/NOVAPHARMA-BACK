import type { Core } from '@strapi/strapi';

export default (plugin: any) => {
    // Store the original methods
    const originalUpdate = plugin.controllers.user.update;
    const originalCreate = plugin.controllers.user.create;

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

    return plugin;
};

