export function returnUrl(target: string | null): string {
  return target &&
    /^\/(dashboard|trips(?:\/[1-9]\d*)?|expenses|reports|users|settings)(?:\?|#|$)/.test(target) &&
    !target.includes('\\')
    ? target
    : '/dashboard';
}
