import React, { useState } from 'react';
import { QueryResult } from '../types';

interface ResultTableProps {
  result: QueryResult;
}

export const ResultTable: React.FC<ResultTableProps> = ({ result }) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDir('asc');
    }
  };

  const sortedRows = React.useMemo(() => {
    if (!sortColumn) return result.rows;
    return [...result.rows].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      // Handle different types for comparison
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal ?? '');
      const bStr = String(bVal ?? '');
      const cmp = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [result.rows, sortColumn, sortDir]);

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      if (value >= 10000) {
        return value.toLocaleString('zh-CN');
      }
      return value.toLocaleString('zh-CN');
    }
    return String(value);
  };

  const getCellClass = (value: unknown): string => {
    if (typeof value === 'number') return 'numeric';
    return '';
  };

  return (
    <div className="result-container">
      <div className="result-header">
        <span className="result-count">{result.rowCount} 行结果</span>
        {result.truncated && (
          <span className="result-truncated">· 已截断</span>
        )}
      </div>

      <div className="table-wrapper">
        <table className="result-table">
          <thead>
            <tr>
              {result.columns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className={sortColumn === col ? 'sorted' : ''}
                >
                  <span className="th-content">
                    {col}
                    {sortColumn === col && (
                      <span className="sort-indicator">
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr key={i}>
                {result.columns.map(col => (
                  <td key={col} className={getCellClass(row[col])}>
                    {formatValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .result-container {
          margin-top: var(--space-3);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: var(--bg-primary);
        }

        .result-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: var(--bg-tertiary);
          border-bottom: 1px solid var(--border);
          font-family: var(--font-mono);
          font-size: var(--text-xs);
        }

        .result-count {
          color: var(--text-secondary);
        }

        .result-truncated {
          color: var(--warning);
        }

        .table-wrapper {
          overflow-x: auto;
          max-height: 400px;
          overflow-y: auto;
        }

        .result-table {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-mono);
          font-size: var(--text-sm);
        }

        .result-table th {
          position: sticky;
          top: 0;
          background: var(--bg-secondary);
          padding: var(--space-3) var(--space-4);
          text-align: left;
          font-weight: 500;
          font-size: var(--text-xs);
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          user-select: none;
          transition: background var(--transition-fast);
        }

        .result-table th:hover {
          background: var(--bg-tertiary);
        }

        .result-table th.sorted {
          color: var(--accent);
        }

        .th-content {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .sort-indicator {
          font-size: var(--text-xs);
          color: var(--accent);
        }

        .result-table td {
          padding: var(--space-3) var(--space-4);
          border-bottom: 1px solid var(--border);
          color: var(--text-primary);
          transition: background var(--transition-fast);
        }

        .result-table tbody tr:hover {
          background: var(--bg-secondary);
        }

        .result-table td.numeric {
          text-align: right;
          font-variant-numeric: tabular-nums;
          color: var(--accent-bright);
        }

        .result-table tbody tr:last-child td {
          border-bottom: none;
        }
      `}</style>
    </div>
  );
};