import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';
import { PrescriptionResponseDto } from '../../prescriptions/dto/prescription-response.dto';

export class AdminPrescriptionListResponseDto extends PaginatedResultDto<PrescriptionResponseDto> {}
