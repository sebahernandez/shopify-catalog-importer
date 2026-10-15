/** Tables the application needs; `PrismaService.connect()` refuses to serve without every one. */
export const EXPECTED_TABLES = ['app_setting', 'store'] as const;
