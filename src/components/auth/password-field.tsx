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
  validate: (value: string) => string | undefined;
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
  validate,
  onChange,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField
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
      <InputGroup fullWidth>
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
