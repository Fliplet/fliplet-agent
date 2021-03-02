require('dotenv').config();

function parseBool(string) {
    switch (string.toLowerCase().trim()) {
        case "true":
        case "yes":
        case "1":
            return true;
        case "false":
        case "no":
        case "0":
        case null:
            return false;
        default:
            return Boolean(string);
    }
}

module.exports.config = {
    authToken: process.env.AUTHTOKEN,
    isDryRun: parseBool(process.env.ISDRYRUN),
    syncOnInit: parseBool(process.env.SYNCONINIT),
    logVerbosity: process.env.LOGVERBOSITY,
    database: {
        dialect: process.env.DATABASE_DIALECT,
        host: process.env.DATABASE_HOST,
        username: process.env.DATABASE_USERNAME,
        password: process.env.DATABASE_PASSWORD,
        port: parseInt(process.env.DATABASE_PORT),
        database: process.env.DATABASE,
    },
    api: process.env.PATIENT_REGISTRATION_SERVICE_URL,
    registrationDataSourceId: parseInt(process.env.REGISTRATION_DATASOURCE_ID),
    synchronisationSchedule: process.env.SYNCHRONISATION_SCHEDULE
};