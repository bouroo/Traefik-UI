import type { Context, MiddlewareHandler, Next } from 'hono';

export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface FieldRule {
  type: FieldType;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export type ValidationSchema = Record<string, FieldRule>;

export interface ValidationError {
  field: string;
  message: string;
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateValue(field: string, value: unknown, rule: FieldRule): string | null {
  if (value === undefined || value === null) {
    if (rule.required) {
      return `${field} is required`;
    }
    return null;
  }

  let actualType: FieldType;
  if (Array.isArray(value)) {
    actualType = 'array';
  } else if (typeof value === 'object') {
    actualType = 'object';
  } else if (typeof value === 'string') {
    actualType = 'string';
  } else if (typeof value === 'number') {
    actualType = 'number';
  } else if (typeof value === 'boolean') {
    actualType = 'boolean';
  } else {
    return `${field} has an unsupported type`;
  }

  if (actualType !== rule.type) {
    return `${field} must be a ${rule.type}`;
  }

  if (rule.type === 'string' && typeof value === 'string') {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return `${field} must be at least ${rule.minLength} characters`;
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return `${field} must be at most ${rule.maxLength} characters`;
    }
  }

  if (rule.type === 'number' && typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return `${field} must be at least ${rule.min}`;
    }
    if (rule.max !== undefined && value > rule.max) {
      return `${field} must be at most ${rule.max}`;
    }
  }

  if (rule.type === 'array' && Array.isArray(value)) {
    if (rule.minLength !== undefined && value.length < rule.minLength) {
      return `${field} must contain at least ${rule.minLength} items`;
    }
    if (rule.maxLength !== undefined && value.length > rule.maxLength) {
      return `${field} must contain at most ${rule.maxLength} items`;
    }
  }

  return null;
}

export function validateData(data: unknown, schema: ValidationSchema): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isPlainObject(data)) {
    return {
      valid: false,
      errors: [{ field: 'body', message: 'Request body must be a JSON object' }],
    };
  }

  for (const [field, rule] of Object.entries(schema)) {
    const message = validateValue(field, data[field], rule);
    if (message) {
      errors.push({ field, message });
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateBody(schema: ValidationSchema): MiddlewareHandler {
  return async (c: Context, next: Next) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json(
        {
          error: 'Validation failed',
          details: [{ field: 'body', message: 'Request body must be valid JSON' }],
        },
        400
      );
    }

    const result = validateData(body, schema);
    if (!result.valid) {
      return c.json({ error: 'Validation failed', details: result.errors }, 400);
    }

    c.set('parsedBody', body);
    await next();
  };
}
