import { Toast } from '@heroui/react';
import Xmark from '@gravity-ui/icons/Xmark';

export function Provider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toast.Provider placement="bottom end">
        {({ toast }) => {
          const { description, indicator, title, variant } = toast.content;

          return (
            <Toast toast={toast} variant={variant}>
              {indicator ? (
                <Toast.Indicator variant={variant}>{indicator}</Toast.Indicator>
              ) : null}
              <Toast.Content>
                {title ? <Toast.Title>{title}</Toast.Title> : null}
                {description ? (
                  <Toast.Description>{description}</Toast.Description>
                ) : null}
              </Toast.Content>
              <Toast.CloseButton aria-label="Đóng thông báo">
                <Xmark aria-hidden="true" className="size-4" />
              </Toast.CloseButton>
            </Toast>
          );
        }}
      </Toast.Provider>
    </>
  );
}
