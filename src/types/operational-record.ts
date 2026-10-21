// Operational history types. `*Dto` mirror smart-locking-be `dev`
// (Application/DTOs/Operations/OperationsDtos.cs, OperationalRecordService).

export type OperationalRecordDto = {
  kind: string;
  id: string;
  code: string;
  status: string;
  lockerCode: string;
  summary: string;
  occurredAt: string;
};

export type OperationalRecordPageDto = {
  items: OperationalRecordDto[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
};

export type OperationalRecordDetailDto = {
  kind: string;
  id: string;
  code: string;
  status: string;
  lockerId: string;
  lockerCode: string;
  occurredAt: string;
  details: Record<string, string | null>;
};

export type OperationalRecord = OperationalRecordDto & {
  /** Whether GET /api/operational-records/{kind}/{id} supports this kind. */
  hasDetail: boolean;
};

export type OperationalRecordPage = {
  items: OperationalRecord[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
};

export type OperationalRecordFilters = {
  query: string;
  lockerId: string;
  kind: string;
  /** `YYYY-MM-DD` from a date input, interpreted in the browser's time zone. */
  fromDate: string;
  toDate: string;
  pageNumber: number;
  pageSize: number;
};

export type OperationalRecordDetailRow = {
  key: string;
  label: string;
  value: string;
};
