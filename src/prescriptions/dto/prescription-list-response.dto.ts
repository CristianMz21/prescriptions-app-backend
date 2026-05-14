/* Copyright (c) 2026. All rights reserved. */
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { PrescriptionResponseDto } from './prescription-response.dto';

export class PrescriptionListResponseDto extends PaginatedResultDto<PrescriptionResponseDto> {}
