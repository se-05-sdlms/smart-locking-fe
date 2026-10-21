import { useState } from 'react';
import {
  Button,
  FieldError,
  InputGroup,
  Label,
  TextField,
} from '@heroui/react';
import Eye from '@gravity-ui/icons/Eye';
import EyeSlash from '@gravity-ui/icons/EyeSlash';

type PasswordFieldProps = {
  label: string;
  name: string;
  value: string;
  autoComplete: string;
  isDisabled: boolean;
  placeholder?: string;
  className?: string;
  /** Surface hierarchy: fields sit on a Card, so `secondary` is the default. */
  variant?: 'primary' | 'secondary';
  validate: (value: string) => string | undefined;
  /**
   * The other field value this validation compares against (e.g. the current
   * password). When it changes, the field drops its committed error so a stale
   * message such as "phải khác mật khẩu hiện tại" is not left behind; it is
   * re-validated on the next blur or submit.
   */
  dependsOn?: string;
  onChange: (value: string) => void;
};

/** Required password input with a show/hide toggle and inline validation. */
export function PasswordField({
  label,
  name,
  value,
  autoComplete,
  isDisabled,
  placeholder,
  className,
  variant = 'secondary',
  validate,
  dependsOn,
  onChange,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField
      key={dependsOn}
      fullWidth
      isRequired
      autoComplete={autoComplete}
      className={className}
      isDisabled={isDisabled}
      name={name}
      type={isVisible ? 'text' : 'password'}
      validate={validate}
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <InputGroup fullWidth variant={variant}>
        <InputGroup.Input placeholder={placeholder} />
        <InputGroup.Suffix>
          <Button
            isIconOnly
            aria-label={
              isVisible
                ? `Ẩn ${label.toLowerCase()}`
                : `Hiện ${label.toLowerCase()}`
            }
            isDisabled={isDisabled}
            size="sm"
            variant="ghost"
            onPress={() => setIsVisible((visible) => !visible)}
          >
            {isVisible ? (
              <EyeSlash aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
      <FieldError />
    </TextField>
  );
}
