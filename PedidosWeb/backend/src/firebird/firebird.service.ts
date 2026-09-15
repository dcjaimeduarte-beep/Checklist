import { Injectable, Logger, ServiceUnavailableException, InternalServerErrorException } from '@nestjs/common'
import * as Firebird from 'node-firebird'

@Injectable()
export class FirebirdService {
  private readonly logger = new Logger(FirebirdService.name)

  private get options(): Firebird.Options {
    return {
      host: process.env.FB_HOST ?? '127.0.0.1',
      port: Number(process.env.FB_PORT ?? 3050),
      database: process.env.FB_DATABASE ?? '',
      user: process.env.FB_USER ?? 'SYSDBA',
      password: process.env.FB_PASSWORD ?? 'masterkey',
      lowercase_keys: true,
      role: undefined,
      pageSize: 4096,
    }
  }

  query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new ServiceUnavailableException('Timeout na consulta ao ERP')), 15_000)

      Firebird.attach(this.options, (err, db) => {
        if (err) {
          clearTimeout(timer)
          this.logger.error('Falha ao conectar ao Firebird', err.message)
          return reject(new ServiceUnavailableException('ERP indisponível — verifique a conexão'))
        }

        db.query(sql, params, (err2, result) => {
          clearTimeout(timer)
          db.detach()

          if (err2) {
            this.logger.error(`Erro na query Firebird: ${sql.substring(0, 80)}`, err2.message)
            return reject(new InternalServerErrorException('Erro na consulta ao banco do ERP'))
          }

          resolve((result ?? []) as T[])
        })
      })
    })
  }

  execute(sql: string, params: unknown[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new ServiceUnavailableException('Timeout na operação no ERP')), 20_000)

      Firebird.attach(this.options, (err, db) => {
        if (err) {
          clearTimeout(timer)
          return reject(new ServiceUnavailableException('ERP indisponível'))
        }

        db.query(sql, params, (err2) => {
          clearTimeout(timer)
          db.detach()
          if (err2) {
            this.logger.error(`Firebird execute error: ${err2.message} | SQL: ${sql.substring(0, 120)}`)
            return reject(new InternalServerErrorException('Erro ao executar operação no ERP'))
          }
          resolve()
        })
      })
    })
  }

  transaction<T>(fn: (db: Firebird.Database, tx: Firebird.Transaction) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new ServiceUnavailableException('Timeout na transação ERP')), 30_000)

      Firebird.attach(this.options, (err, db) => {
        if (err) {
          clearTimeout(timer)
          return reject(new ServiceUnavailableException('ERP indisponível'))
        }

        db.transaction(Firebird.ISOLATION_READ_COMMITTED, (err2, tx) => {
          if (err2) {
            clearTimeout(timer)
            db.detach()
            return reject(new InternalServerErrorException('Erro ao iniciar transação no ERP'))
          }

          fn(db, tx)
            .then((result) => {
              tx.commit((err3) => {
                clearTimeout(timer)
                db.detach()
                if (err3) return reject(new InternalServerErrorException('Erro ao confirmar transação'))
                resolve(result)
              })
            })
            .catch((error: unknown) => {
              tx.rollback(() => {
                clearTimeout(timer)
                db.detach()
              })
              reject(error)
            })
        })
      })
    })
  }
}
