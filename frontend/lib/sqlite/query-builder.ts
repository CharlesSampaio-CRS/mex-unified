/**
 * SQLite Query Builder
 * 
 * API fluente para construir queries SQL de forma type-safe
 * Elimina a necessidade de escrever SQL manual
 */

import { sqliteDatabase } from './database'

type WhereOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN'
type OrderDirection = 'ASC' | 'DESC' | 'asc' | 'desc'

interface WhereClause {
  column: string
  operator: WhereOperator
  value: any
  connector: 'AND' | 'OR'
}

export class QueryBuilder<T = any> {
  private tableName: string
  private selectColumns: string[] = ['*']
  private whereClauses: WhereClause[] = []
  private orderByColumn: string | null = null
  private orderByDirection: OrderDirection = 'ASC'
  private limitValue: number | null = null
  private offsetValue: number | null = null

  constructor(table: string) {
    this.tableName = table
  }

  /**
   * Define quais colunas selecionar
   */
  select(...columns: string[]): this {
    this.selectColumns = columns.length > 0 ? columns : ['*']
    return this
  }

  /**
   * Adiciona condição WHERE
   */
  where(column: string, operatorOrValue: WhereOperator | any, value?: any): this {
    let operator: WhereOperator = '='
    let actualValue: any

    if (value === undefined) {
      // where('column', value) - operador padrão é '='
      actualValue = operatorOrValue
    } else {
      // where('column', '>=', value)
      operator = operatorOrValue as WhereOperator
      actualValue = value
    }

    this.whereClauses.push({
      column,
      operator,
      value: actualValue,
      connector: 'AND'
    })

    return this
  }

  /**
   * Adiciona condição WHERE com OR
   */
  orWhere(column: string, operatorOrValue: WhereOperator | any, value?: any): this {
    let operator: WhereOperator = '='
    let actualValue: any

    if (value === undefined) {
      actualValue = operatorOrValue
    } else {
      operator = operatorOrValue as WhereOperator
      actualValue = value
    }

    this.whereClauses.push({
      column,
      operator,
      value: actualValue,
      connector: 'OR'
    })

    return this
  }

  /**
   * WHERE IN
   */
  whereIn(column: string, values: any[]): this {
    this.whereClauses.push({
      column,
      operator: 'IN',
      value: values,
      connector: 'AND'
    })
    return this
  }

  /**
   * WHERE NOT IN
   */
  whereNotIn(column: string, values: any[]): this {
    this.whereClauses.push({
      column,
      operator: 'NOT IN',
      value: values,
      connector: 'AND'
    })
    return this
  }

  /**
   * WHERE LIKE
   */
  whereLike(column: string, pattern: string): this {
    this.whereClauses.push({
      column,
      operator: 'LIKE',
      value: pattern,
      connector: 'AND'
    })
    return this
  }

  /**
   * Ordena resultados
   */
  orderBy(column: string, direction: OrderDirection = 'ASC'): this {
    this.orderByColumn = column
    this.orderByDirection = direction
    return this
  }

  /**
   * Limita número de resultados
   */
  limit(value: number): this {
    this.limitValue = value
    return this
  }

  /**
   * Offset de resultados (paginação)
   */
  offset(value: number): this {
    this.offsetValue = value
    return this
  }

  /**
   * Constrói e executa query SELECT
   */
  async get(): Promise<T[]> {
    try {
      console.log('📋 [QueryBuilder] get() iniciado para tabela:', this.tableName)
      
      const { sql, params } = this.buildSelectQuery()
      console.log('📝 [QueryBuilder] SQL:', sql)
      console.log('📝 [QueryBuilder] Params:', params)
      
      const results = await sqliteDatabase.queryAll<T>(sql, params)
      console.log('✅ [QueryBuilder] get() retornando', results.length, 'registros')
      
      return results
    } catch (error) {
      console.error('❌ [QueryBuilder] ERRO em get():', error)
      console.error('❌ [QueryBuilder] Tabela:', this.tableName)
      console.error('❌ [QueryBuilder] Stack:', error instanceof Error ? error.stack : error)
      return []
    }
  }

  /**
   * Retorna o primeiro resultado
   */
  async first(): Promise<T | null> {
    this.limit(1)
    const results = await this.get()
    return results.length > 0 ? results[0] : null
  }

  /**
   * Conta registros
   */
  async count(): Promise<number> {
    try {
      console.log('🔢 [QueryBuilder] count() iniciado para tabela:', this.tableName)
      
      const originalColumns = this.selectColumns
      this.selectColumns = ['COUNT(*) as count']
      
      const { sql, params } = this.buildSelectQuery()
      console.log('📝 [QueryBuilder] SQL gerado:', sql)
      console.log('📝 [QueryBuilder] Params:', params)
      
      const result = await sqliteDatabase.queryFirst<{ count: number }>(sql, params)
      console.log('📊 [QueryBuilder] Resultado:', result)
      
      this.selectColumns = originalColumns
      
      const count = result?.count || 0
      console.log('✅ [QueryBuilder] count() retornando:', count)
      return count
    } catch (error) {
      console.error('❌ [QueryBuilder] ERRO SILENCIOSO em count():', error)
      console.error('❌ [QueryBuilder] Tabela:', this.tableName)
      console.error('❌ [QueryBuilder] Stack:', error instanceof Error ? error.stack : error)
      return 0
    }
  }

  /**
   * Insere um registro
   */
  async insert(data: Partial<T>): Promise<number | undefined> {
    try {
      console.log('🔵 [QueryBuilder] insert() iniciado')
      console.log('📋 [QueryBuilder] Tabela:', this.tableName)
      console.log('📥 [QueryBuilder] Dados:', JSON.stringify(data, null, 2))

      const columns = Object.keys(data)
      const values = Object.values(data)
      const placeholders = values.map(() => '?').join(', ')

      const sql = `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`
      
      console.log('📝 [QueryBuilder] SQL:', sql)
      console.log('📝 [QueryBuilder] Values:', values)

      const result = await sqliteDatabase.query(sql, values)
      
      console.log('✅ [QueryBuilder] INSERT result:', {
        insertId: result.insertId,
        rowsAffected: result.rowsAffected
      })
      
      return result.insertId
    } catch (error) {
      console.error('❌ [QueryBuilder] Erro no insert():', error)
      console.error('❌ [QueryBuilder] Stack:', error instanceof Error ? error.stack : error)
      throw error
    }
  }

  /**
   * Atualiza registros
   */
  async update(data: Partial<T>): Promise<number> {
    const updates = Object.keys(data)
      .map(key => `${key} = ?`)
      .join(', ')

    const { whereClause, params: whereParams } = this.buildWhereClause()
    const values = [...Object.values(data), ...whereParams]

    const sql = `UPDATE ${this.tableName} SET ${updates}${whereClause}`
    const result = await sqliteDatabase.query(sql, values)
    
    return result.rowsAffected
  }

  /**
   * Deleta registros
   */
  async delete(): Promise<number> {
    const { whereClause, params } = this.buildWhereClause()
    const sql = `DELETE FROM ${this.tableName}${whereClause}`
    const result = await sqliteDatabase.query(sql, params)
    
    return result.rowsAffected
  }

  /**
   * Constrói query SELECT completa
   */
  private buildSelectQuery(): { sql: string; params: any[] } {
    const columns = this.selectColumns.join(', ')
    let sql = `SELECT ${columns} FROM ${this.tableName}`
    
    const { whereClause, params } = this.buildWhereClause()
    sql += whereClause

    if (this.orderByColumn) {
      sql += ` ORDER BY ${this.orderByColumn} ${this.orderByDirection}`
    }

    if (this.limitValue !== null) {
      sql += ` LIMIT ${this.limitValue}`
    }

    if (this.offsetValue !== null) {
      sql += ` OFFSET ${this.offsetValue}`
    }

    return { sql, params }
  }

  /**
   * Constrói cláusula WHERE
   */
  private buildWhereClause(): { whereClause: string; params: any[] } {
    if (this.whereClauses.length === 0) {
      return { whereClause: '', params: [] }
    }

    const params: any[] = []
    const conditions: string[] = []

    this.whereClauses.forEach((clause, index) => {
      const connector = index === 0 ? '' : ` ${clause.connector} `

      if (clause.operator === 'IN' || clause.operator === 'NOT IN') {
        const placeholders = clause.value.map(() => '?').join(', ')
        conditions.push(`${connector}${clause.column} ${clause.operator} (${placeholders})`)
        params.push(...clause.value)
      } else {
        conditions.push(`${connector}${clause.column} ${clause.operator} ?`)
        params.push(clause.value)
      }
    })

    return {
      whereClause: ` WHERE ${conditions.join('')}`,
      params
    }
  }

  /**
   * Debug: mostra SQL gerado
   */
  toSQL(): { sql: string; params: any[] } {
    return this.buildSelectQuery()
  }
}

// Factory function
export function table<T = any>(tableName: string): QueryBuilder<T> {
  return new QueryBuilder<T>(tableName)
}

export default QueryBuilder
