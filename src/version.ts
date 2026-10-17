import packageInfo from '../package.json' with { type: 'json' };

export const VERSION: string = packageInfo.version;
