const customRoutes = [
    {
        method: 'POST',
        path: '/backups/create',
        handler: 'backup.create',
        config: {
            policies: [],
            middlewares: [],
        },
    },
    {
        method: 'POST',
        path: '/backups/create-sync',
        handler: 'backup.createSync',
        config: {
            policies: [],
            middlewares: [],
        },
    },
    {
        method: 'GET',
        path: '/backups/:backupId/progress',
        handler: 'backup.getProgress',
        config: {
            policies: [],
            middlewares: [],
        },
    },
    {
        method: 'POST',
        path: '/backups/:backupId/restore',
        handler: 'backup.restore',
        config: {
            policies: [],
            middlewares: [],
        },
    },
    {
        method: 'GET',
        path: '/backups/files',
        handler: 'backup.listFiles',
        config: {
            policies: [],
            middlewares: [],
        },
    },
    {
        method: 'DELETE',
        path: '/backups/files/:filename',
        handler: 'backup.deleteFile',
        config: {
            policies: [],
            middlewares: [],
        },
    },
];

const config = {
    type: 'content-api',
    routes: customRoutes,
};

export default config;

