export function getPasswordPolicyState(password: string) {
  // 浏览器只提供即时提示；规则须与 Supabase Auth 保持一致，最终仍由认证服务校验。
  const hasMinLength = password.length >= 10;
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);

  return {
    hasLetter: hasLowercase || hasUppercase,
    hasLowercase,
    hasMinLength,
    hasNumber,
    hasUppercase,
    isValid: hasMinLength && hasLowercase && hasUppercase && hasNumber,
  };
}
