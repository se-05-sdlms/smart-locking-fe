import type { LocationFormValues } from '@/services/operator-coverage-service';

import { useRef, useState } from 'react';
import {
  Alert,
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Skeleton,
  TextField,
  Typography,
  toast,
} from '@heroui/react';
import CircleCheck from '@gravity-ui/icons/CircleCheck';

import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  confirmLockerLocation,
  getCoverageErrorMessage,
  getLockerLocation,
  locationWarning,
  toLocationForm,
  validateLocationForm,
} from '@/services/operator-coverage-service';

/** Coordinates and service area used to suggest substitute operators (#86). */
export function LockerLocationSection({
  lockerId,
  address,
}: {
  lockerId: string;
  address: string;
}) {
  const { state, setState } = useAsyncResource(
    (signal) => getLockerLocation(lockerId, signal),
    getCoverageErrorMessage,
    [lockerId],
  );
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<LocationFormValues>(() =>
    toLocationForm(null),
  );
  const [errors, setErrors] = useState<
    Partial<Record<keyof LocationFormValues, string>>
  >({});
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const pending = useRef(false);
  const location = state.data ?? null;
  const warning = state.data ? locationWarning(location) : '';

  const update = (patch: Partial<LocationFormValues>) => {
    const next = { ...values, ...patch };

    setValues(next);
    if (Object.keys(errors).length) setErrors(validateLocationForm(next));
  };

  const save = async () => {
    const next = validateLocationForm(values);

    setErrors(next);
    if (Object.keys(next).length || pending.current) return;
    pending.current = true;
    setIsSaving(true);
    setError('');
    try {
      const saved = await confirmLockerLocation(lockerId, values);

      setState({ status: 'success', data: saved });
      setIsEditing(false);
      toast.success('Đã xác nhận vị trí tủ', {
        indicator: <CircleCheck aria-hidden="true" className="size-5" />,
      });
    } catch (saveError) {
      setError(getCoverageErrorMessage(saveError));
    } finally {
      pending.current = false;
      setIsSaving(false);
    }
  };

  const coordinateField = (key: 'latitude' | 'longitude', label: string) => (
    <TextField
      fullWidth
      isInvalid={Boolean(errors[key])}
      value={values[key]}
      onChange={(value) => update({ [key]: value })}
    >
      <Label>{label}</Label>
      <Input inputMode="decimal" variant="secondary" />
      <FieldError>{errors[key]}</FieldError>
    </TextField>
  );

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <Typography type="h6">Vị trí & khu vực phục vụ</Typography>
        {!isEditing && state.status !== 'loading' ? (
          <Button
            size="sm"
            variant="secondary"
            onPress={() => {
              setValues(toLocationForm(location));
              setErrors({});
              setError('');
              setIsEditing(true);
            }}
          >
            {location?.confirmedAt ? 'Chỉnh vị trí' : 'Xác nhận vị trí'}
          </Button>
        ) : null}
      </div>
      {state.status === 'loading' && !state.data ? (
        <Skeleton className="h-12 w-full rounded-lg" />
      ) : null}
      {state.status === 'error' && !state.data ? (
        <p className="text-sm text-danger">{state.message}</p>
      ) : null}
      {location && !isEditing ? (
        <p className="text-sm">
          {location.latitude !== null && location.longitude !== null
            ? `${location.latitude}, ${location.longitude}`
            : 'Chưa có tọa độ'}
          {' · '}
          {location.serviceArea ?? 'Chưa có khu vực'}
          {location.confirmedAt ? (
            <span className="block text-xs text-muted">
              Xác nhận lúc{' '}
              {new Date(location.confirmedAt).toLocaleString('vi-VN')}
            </span>
          ) : null}
        </p>
      ) : null}
      {warning && !isEditing ? (
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{warning}</Alert.Description>
          </Alert.Content>
        </Alert>
      ) : null}
      {isEditing ? (
        <div className="space-y-3">
          <p className="text-xs text-muted">
            Lấy tọa độ đúng địa chỉ đặt tủ: {address}. Dùng để tính khoảng cách
            giữa các tủ khi đề xuất người thay.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {coordinateField('latitude', 'Vĩ độ')}
            {coordinateField('longitude', 'Kinh độ')}
          </div>
          <TextField
            fullWidth
            isInvalid={Boolean(errors.serviceArea)}
            value={values.serviceArea}
            onChange={(serviceArea) => update({ serviceArea })}
          >
            <Label>Khu vực phục vụ</Label>
            <Input placeholder="VD: Quận 7" variant="secondary" />
            <Description>
              Ghi giống khu vực trong chính sách thay thế Operator.
            </Description>
            <FieldError>{errors.serviceArea}</FieldError>
          </TextField>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex gap-2">
            <Button
              isDisabled={isSaving}
              size="sm"
              variant="secondary"
              onPress={() => setIsEditing(false)}
            >
              Hủy
            </Button>
            <Button
              isPending={isSaving}
              size="sm"
              variant="primary"
              onPress={() => void save()}
            >
              Lưu vị trí
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
