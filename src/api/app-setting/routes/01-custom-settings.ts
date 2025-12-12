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
            auth: false,
        },
    },
    {
        method: 'PUT',
        path: '/app-settings/default',
        handler: 'app-setting.updateDefault',
        config: {
            auth: false,
        },
    },
];

const config = {
    type: 'content-api',
    routes: customRoutes
};

export default config;