import { BadRequestException, Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { dashboardPeriodSchema, dashboardRangeSchema } from '@mon-cher-savon/contracts';
import { GetDashboardUseCase } from '../../application/dashboard.use-case.js';
import { AdminGuard } from './admin.guard.js';

@ApiTags('admin')
@UseGuards(AdminGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(@Inject(GetDashboardUseCase) private readonly dashboard: GetDashboardUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Números da loja no período (hoje, 7 dias, mês ou datas livres)' })
  @ApiQuery({ name: 'period', enum: ['hoje', '7dias', 'mes', 'personalizado'], required: false })
  @ApiQuery({ name: 'from', required: false, description: 'AAAA-MM-DD (só com personalizado)' })
  @ApiQuery({ name: 'to', required: false, description: 'AAAA-MM-DD (só com personalizado)' })
  get(@Query('period') period?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const parsed = dashboardPeriodSchema.default('hoje').parse(period);
    if (parsed !== 'personalizado') return this.dashboard.execute(parsed);
    const range = dashboardRangeSchema.safeParse({ from, to });
    if (!range.success) {
      throw new BadRequestException(range.error.issues[0]?.message ?? 'Intervalo inválido');
    }
    return this.dashboard.execute(parsed, range.data);
  }
}
