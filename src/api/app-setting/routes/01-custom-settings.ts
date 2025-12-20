const customRoutes = [
    {
        method: 'GET',
        path: '/app-settings/default',
        handler: 'app-setting.getDefault',
        config: {
            auth: false,
        },
    },
    {
        method: 'POST',
        path: '/app-settings/default',
        handler: 'app-setting.createDefault',
        config: {

        },
    },
    {
        method: 'PUT',
        path: '/app-settings/default',
        handler: 'app-setting.updateDefault',
        config: {

        },
    },
];

const config = {
    type: 'content-api',
    routes: customRoutes
};

export default config;