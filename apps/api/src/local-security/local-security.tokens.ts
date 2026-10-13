/** Injection token for the `GuardPolicy` derived from the configuration. */
export const LOCAL_SECURITY_POLICY = Symbol('LOCAL_SECURITY_POLICY');

/** Injection token for the logger the guard reports rejections to (warn only, check name only). */
export const LOCAL_SECURITY_LOGGER = Symbol('LOCAL_SECURITY_LOGGER');
