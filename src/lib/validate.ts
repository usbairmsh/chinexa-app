import { NextResponse } from "next/server";

type ValidationRule = {
  field: string;
  value: unknown;
  rules: (
    | "required"
    | "string"
    | "number"
    | "positive"
    | "email"
    | "phone"
    | { min: number }
    | { max: number }
    | { minLength: number }
    | { maxLength: number }
    | { oneOf: string[] }
    | { range: [number, number] }
  )[];
  label?: string;
};

export function validate(rules: ValidationRule[]): string | null {
  for (const { field, value, rules: checks, label } of rules) {
    const name = label || field;
    for (const check of checks) {
      if (check === "required") {
        if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
          return `${name} is required`;
        }
      }
      if (check === "string" && value !== undefined && value !== null && typeof value !== "string") {
        return `${name} must be a string`;
      }
      if (check === "number") {
        if (value !== undefined && value !== null && (typeof value !== "number" || isNaN(value))) {
          return `${name} must be a number`;
        }
      }
      if (check === "positive") {
        if (typeof value === "number" && value < 0) {
          return `${name} cannot be negative`;
        }
      }
      if (check === "email" && typeof value === "string" && value.trim()) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return `${name} is not a valid email address`;
        }
      }
      if (check === "phone" && typeof value === "string" && value.trim()) {
        const cleaned = value.replace(/[\s\-+]/g, "");
        if (!/^\d{10,15}$/.test(cleaned)) {
          return `${name} is not a valid phone number`;
        }
      }
      if (typeof check === "object") {
        if ("min" in check && typeof value === "number" && value < check.min) {
          return `${name} must be at least ${check.min}`;
        }
        if ("max" in check && typeof value === "number" && value > check.max) {
          return `${name} must be at most ${check.max}`;
        }
        if ("minLength" in check && typeof value === "string" && value.trim().length < check.minLength) {
          return `${name} must be at least ${check.minLength} characters`;
        }
        if ("maxLength" in check && typeof value === "string" && value.length > check.maxLength) {
          return `${name} must be at most ${check.maxLength} characters`;
        }
        if ("oneOf" in check && typeof value === "string" && !check.oneOf.includes(value)) {
          return `${name} must be one of: ${check.oneOf.join(", ")}`;
        }
        if ("range" in check && typeof value === "number" && (value < check.range[0] || value > check.range[1])) {
          return `${name} must be between ${check.range[0]} and ${check.range[1]}`;
        }
      }
    }
  }
  return null;
}

/** Return a 400 response with the validation error */
export function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Return a 404 response for missing dependencies */
export function dependencyError(entity: string, id?: string) {
  return NextResponse.json(
    { error: `${entity}${id ? ` (${id})` : ""} not found. Please create it first.` },
    { status: 400 }
  );
}
