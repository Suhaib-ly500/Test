function validate(rules, body) {
  const errors = [];
  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = body ? body[field] : undefined;
    if (fieldRules.required && (value === undefined || value === null || String(value).trim() === '')) {
      errors.push(fieldRules.label || field + ' مطلوب');
      continue;
    }
    if (value === undefined || value === null || value === '') continue;
    const strVal = String(value);
    if (fieldRules.type === 'string') {
      if (fieldRules.minLength && strVal.length < fieldRules.minLength) errors.push((fieldRules.label || field) + ' يجب أن يكون على الأقل ' + fieldRules.minLength + ' حرف');
      if (fieldRules.maxLength && strVal.length > fieldRules.maxLength) errors.push((fieldRules.label || field) + ' يجب أن لا يتجاوز ' + fieldRules.maxLength + ' حرف');
      if (fieldRules.pattern && !fieldRules.pattern.test(strVal)) errors.push(fieldRules.label || field + ' غير صالح');
    }
    if (fieldRules.type === 'number') {
      const num = Number(value);
      if (isNaN(num)) errors.push((fieldRules.label || field) + ' يجب أن يكون رقماً');
      else {
        if (fieldRules.min !== undefined && num < fieldRules.min) errors.push((fieldRules.label || field) + ' يجب أن يكون ' + fieldRules.min + ' فأكثر');
        if (fieldRules.max !== undefined && num > fieldRules.max) errors.push((fieldRules.label || field) + ' يجب أن يكون ' + fieldRules.max + ' فأقل');
      }
    }
    if (fieldRules.type === 'array') {
      if (!Array.isArray(value)) errors.push((fieldRules.label || field) + ' يجب أن يكون مصفوفة');
      else if (fieldRules.minLength && value.length < fieldRules.minLength) errors.push((fieldRules.label || field) + ' يجب أن يحتوي على ' + fieldRules.minLength + ' عناصر على الأقل');
    }
    if (fieldRules.oneOf && !fieldRules.oneOf.includes(strVal)) errors.push((fieldRules.label || field) + ' غير صالح: ' + fieldRules.oneOf.join(' أو '));
  }
  return errors.length ? errors.join('، ') : null;
}

module.exports = { validate };