import type { ComponentPropsWithoutRef } from "react";

const INPUT_CLASSES =
  "mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-800";

type FieldWrapperProps = {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
};

function FieldWrapper({ label, htmlFor, children }: FieldWrapperProps) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
      {children}
    </div>
  );
}

type TextFieldProps = ComponentPropsWithoutRef<"input"> & { label: string };

export function TextField({ label, id, className = "", ...props }: TextFieldProps) {
  return (
    <FieldWrapper label={label} htmlFor={id!}>
      <input id={id} className={`${INPUT_CLASSES} ${className}`} {...props} />
    </FieldWrapper>
  );
}

type SelectFieldProps = ComponentPropsWithoutRef<"select"> & {
  label: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};

export function SelectField({
  label,
  id,
  options,
  placeholder,
  className = "",
  ...props
}: SelectFieldProps) {
  return (
    <FieldWrapper label={label} htmlFor={id!}>
      <select id={id} className={`${INPUT_CLASSES} ${className}`} {...props}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

type CheckboxFieldProps = ComponentPropsWithoutRef<"input"> & { label: string };

export function CheckboxField({ label, id, ...props }: CheckboxFieldProps) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
        {...props}
      />
      {label}
    </label>
  );
}
