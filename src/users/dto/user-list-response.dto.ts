import { UserEntity } from '../entities/user.entity';
import { PaginatedResultDto } from '../../common/dto/paginated-result.dto';

export class UserListResponseDto extends PaginatedResultDto<UserEntity> {}
