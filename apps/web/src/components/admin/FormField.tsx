// Braum 布隆 CF 探针 — 表单输入组件
import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface BaseFieldProps {
  label: string
  error?: string
  required?: boolean
}

type InputFieldProps = BaseFieldProps &
  InputHTMLAttributes<HTMLInputElement> & {
    type?: 'text' | 'number' | 'email' | 'password' | 'url'
    as?: 'input'
  }

type SelectFieldProps = BaseFieldProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    as: 'select'
    options: { value: string; label: string }[]
  }

type TextareaFieldProps = BaseFieldProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & {
    as: 'textarea'
    rows?: number
  }

type CheckboxFieldProps = BaseFieldProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
    as: 'checkbox'
  }

type FormFieldProps = InputFieldProps | SelectFieldProps | TextareaFieldProps | CheckboxFieldProps

export default function FormField(props: FormFieldProps) {
  const { label, error, required } = props
  const baseClass =
    'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-brand-500 focus:ring-1 focus:ring-brand-500'
  const errorClass = 'border-red-500 focus:border-red-500 focus:ring-red-500'

  if (props.as === 'select') {
    const { options, as: _, ...rest } = props as SelectFieldProps
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <select className={`${baseClass} ${error ? errorClass : ''}`} {...rest}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  if (props.as === 'textarea') {
    const { rows = 3, as: _, ...rest } = props as TextareaFieldProps
    return (
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <textarea rows={rows} className={`${baseClass} ${error ? errorClass : ''}`} {...rest} />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  if (props.as === 'checkbox') {
    const { as: _, ...rest } = props as CheckboxFieldProps
    return (
      <div className="flex items-center gap-2">
        <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-500" {...rest} />
        <label className="text-sm text-slate-700 dark:text-slate-300">{label}</label>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    )
  }

  // Default: input
  const { type = 'text', as: _, ...rest } = props as InputFieldProps
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input type={type} className={`${baseClass} ${error ? errorClass : ''}`} {...rest} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}
