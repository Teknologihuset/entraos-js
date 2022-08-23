declare global {
    namespace NodeJS {
        interface ProcessEnv {
            PORT: number;
            NODE_ENV: 'development' | 'production';
            ENTRAOS_CONFIG: string;
            TEKNOLOGIHUSET_CLIENT_ID: string;
            TEKNOLOGIHUSET_CLIENT_SECRET: string;
            COOKIE_SECRET?: string;
        }
    }
}

export {};