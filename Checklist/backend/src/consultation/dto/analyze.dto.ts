import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Entrada da análise — consulta e agregação ocorrem no backend. */
export class AnalyzeDto {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  ncm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  regime?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  year?: string;

  /** Termo livre adicional (legislação, palavras-chave). */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  query?: string;
}
