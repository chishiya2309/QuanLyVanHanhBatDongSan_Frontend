import { describe, expect, it } from 'vitest';
import {
  decodeCustomerPageResponse,
  decodeCustomerResponse,
  decodeCustomerVehiclesResponse,
  decodeVehicleResponse,
  encodeCreateCustomerBody,
  encodeCreateVehicleBody,
  encodeUpdateCustomerBody,
  encodeUpdateVehicleBody,
  parseCustomerJson,
  safeVersion,
} from '../src/services/customerCodec';
import {
  formatDateDisplay,
  isIdentityType,
  isVehicleType,
  isValidIsoDate,
  normalizeIdentityNo,
  validateCustomerForm,
  validateVehicleForm,
} from '../src/utils/customerValidation';

describe('Customer Validation & Helpers', () => {
  it('validates identity types and vehicle types', () => {
    expect(isIdentityType('CCCD')).toBe(true);
    expect(isIdentityType('PASSPORT')).toBe(true);
    expect(isIdentityType('OTHER')).toBe(false);

    expect(isVehicleType('MOTORBIKE')).toBe(true);
    expect(isVehicleType('CAR')).toBe(true);
    expect(isVehicleType('BICYCLE')).toBe(true);
    expect(isVehicleType('OTHER')).toBe(true);
    expect(isVehicleType('PLANE')).toBe(false);
  });

  it('normalizes identityNo to trimmed uppercase', () => {
    expect(normalizeIdentityNo('  ab1234cd  ')).toBe('AB1234CD');
    expect(normalizeIdentityNo('')).toBe(null);
    expect(normalizeIdentityNo(null)).toBe(null);
  });

  it('validates ISO dates strictly', () => {
    expect(isValidIsoDate('2000-02-29')).toBe(true);
    expect(isValidIsoDate('2001-02-29')).toBe(false);
    expect(isValidIsoDate('2023-13-01')).toBe(false);
    expect(isValidIsoDate('2023-00-10')).toBe(false);
    expect(isValidIsoDate('invalid')).toBe(false);
  });

  it('formats dates for display as dd/MM/yyyy', () => {
    expect(formatDateDisplay('2000-05-20')).toBe('20/05/2000');
    expect(formatDateDisplay(null)).toBe('—');
  });

  it('validates customer form fields correctly', () => {
    const emptyForm = validateCustomerForm({
      fullName: '',
      phone: '',
      email: '',
      identityType: '',
      identityNo: '',
      birthDate: '',
      address: '',
      note: '',
    });
    expect(emptyForm.fullName).toBe('Vui lòng nhập họ tên');

    const invalidEmailForm = validateCustomerForm({
      fullName: 'Nguyễn Văn An',
      phone: '',
      email: 'not-an-email',
      identityType: '',
      identityNo: '',
      birthDate: '',
      address: '',
      note: '',
    });
    expect(invalidEmailForm.email).toBe('Email không hợp lệ');

    const incompleteIdentityForm1 = validateCustomerForm({
      fullName: 'Nguyễn Văn An',
      phone: '',
      email: '',
      identityType: 'CCCD',
      identityNo: '',
      birthDate: '',
      address: '',
      note: '',
    });
    expect(incompleteIdentityForm1.identityNo).toBe('Vui lòng nhập số giấy tờ');

    const incompleteIdentityForm2 = validateCustomerForm({
      fullName: 'Nguyễn Văn An',
      phone: '',
      email: '',
      identityType: '',
      identityNo: '123456789',
      birthDate: '',
      address: '',
      note: '',
    });
    expect(incompleteIdentityForm2.identityType).toBe('Vui lòng chọn loại giấy tờ');
  });

  it('validates vehicle form fields including plateNumber for BICYCLE', () => {
    const invalidType = validateVehicleForm({
      type: '',
      plateNumber: '59A-123',
      note: '',
    });
    expect(invalidType.type).toBe('Vui lòng chọn loại phương tiện');

    const missingBicyclePlate = validateVehicleForm({
      type: 'BICYCLE',
      plateNumber: '',
      note: '',
    });
    expect(missingBicyclePlate.plateNumber).toBe('Vui lòng nhập biển số');

    const validBicycle = validateVehicleForm({
      type: 'BICYCLE',
      plateNumber: 'XD-01',
      note: 'Xe đạp gấp',
    });
    expect(Object.keys(validBicycle)).toHaveLength(0);
  });
});

describe('Customer Codec & Lossless Precision', () => {
  it('preserves 64-bit integer versions beyond Number.MAX_SAFE_INTEGER', () => {
    const largeVersion = '9007199254740993'; // 2^53 + 1
    const rawJson = `{"version": ${largeVersion}}`;
    const parsed = parseCustomerJson(rawJson) as { version: unknown };
    expect(safeVersion(parsed.version)).toBe(largeVersion);
  });

  it('decodes CustomerResponse correctly', () => {
    const rawJson = `
      {
        "id": "11111111-1111-4111-8111-111111111111",
        "fullName": "Nguyễn Văn An",
        "phone": "0901234567",
        "email": "an@example.com",
        "identityType": "CCCD",
        "identityNo": "079090123456",
        "birthDate": "1995-10-15",
        "address": "TP. Hồ Chí Minh",
        "note": "Khách thuê thân thiện",
        "version": 3
      }
    `;
    const parsed = parseCustomerJson(rawJson);
    const decoded = decodeCustomerResponse(parsed);

    expect(decoded.id).toBe('11111111-1111-4111-8111-111111111111');
    expect(decoded.fullName).toBe('Nguyễn Văn An');
    expect(decoded.identityType).toBe('CCCD');
    expect(decoded.version).toBe('3');
  });

  it('decodes CustomerPageResponse correctly', () => {
    const rawJson = `
      {
        "content": [
          {
            "id": "11111111-1111-4111-8111-111111111111",
            "fullName": "Nguyễn Văn An",
            "phone": null,
            "email": null,
            "identityType": null,
            "identityNo": null,
            "birthDate": null,
            "address": null,
            "note": null,
            "version": 0
          }
        ],
        "page": 0,
        "size": 20,
        "totalElements": 1,
        "totalPages": 1,
        "first": true,
        "last": true
      }
    `;
    const parsed = parseCustomerJson(rawJson);
    const page = decodeCustomerPageResponse(parsed);

    expect(page.content).toHaveLength(1);
    expect(page.totalElements).toBe(1);
    expect(page.first).toBe(true);
    expect(page.last).toBe(true);
  });

  it('decodes VehicleResponse and CustomerVehiclesResponse correctly', () => {
    const rawJson = `
      {
        "customerId": "11111111-1111-4111-8111-111111111111",
        "customerVersion": 2,
        "vehicles": [
          {
            "id": "22222222-2222-4222-8222-222222222222",
            "customerId": "11111111-1111-4111-8111-111111111111",
            "type": "MOTORBIKE",
            "plateNumber": "59A1-123.45",
            "note": "Vision màu đỏ",
            "version": 0,
            "customerVersion": 2
          }
        ]
      }
    `;
    const parsed = parseCustomerJson(rawJson);
    const res = decodeCustomerVehiclesResponse(parsed);

    expect(res.customerId).toBe('11111111-1111-4111-8111-111111111111');
    expect(res.customerVersion).toBe('2');
    expect(res.vehicles).toHaveLength(1);
    expect(res.vehicles[0].plateNumber).toBe('59A1-123.45');
    expect(res.vehicles[0].type).toBe('MOTORBIKE');

    const single = decodeVehicleResponse((parsed as Record<string, unknown>).vehicles && ((parsed as Record<string, unknown>).vehicles as unknown[])[0]);
    expect(single.plateNumber).toBe('59A1-123.45');
  });

  it('encodes create and update bodies properly', () => {
    const createBody = encodeCreateCustomerBody({
      fullName: '  Lê Văn Bình  ',
      identityType: 'PASSPORT',
      identityNo: '  ab123456  ',
    });
    expect(createBody).toContain('"fullName":"Lê Văn Bình"');
    expect(createBody).toContain('"identityNo":"AB123456"');
    expect(createBody).not.toContain('"version"');

    const updateBody = encodeUpdateCustomerBody({
      fullName: 'Lê Văn Bình',
      version: '5',
      phone: '',
      email: null,
    });
    expect(updateBody).toContain('"version":5');
    expect(updateBody).toContain('"phone":null');
    expect(updateBody).toContain('"email":null');

    const createVehicle = encodeCreateVehicleBody({
      type: 'BICYCLE',
      plateNumber: 'XD-99',
      customerVersion: '10',
    });
    expect(createVehicle).toContain('"type":"BICYCLE"');
    expect(createVehicle).toContain('"plateNumber":"XD-99"');
    expect(createVehicle).toContain('"customerVersion":10');

    const updateVehicle = encodeUpdateVehicleBody({
      type: 'CAR',
      plateNumber: '51F-888.88',
      version: '1',
      customerVersion: '10',
      note: 'Sedan đen',
    });
    expect(updateVehicle).toContain('"version":1');
    expect(updateVehicle).toContain('"customerVersion":10');
  });
});
