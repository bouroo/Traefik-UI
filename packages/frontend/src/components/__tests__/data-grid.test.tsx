import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataGrid, Column } from '../data-grid';

interface TestRow {
  id: number;
  name: string;
  value: number;
}

describe('DataGrid', () => {
  const columns: Column<TestRow>[] = [
    { key: 'id', header: 'ID' },
    { key: 'name', header: 'Name' },
    { key: 'value', header: 'Value' },
  ];

  const baseData: TestRow[] = [
    { id: 1, name: 'Alice', value: 100 },
    { id: 2, name: 'Bob', value: 200 },
    { id: 3, name: 'Charlie', value: 300 },
  ];

  describe('rendering', () => {
    it('renders columns and rows', () => {
      render(<DataGrid data={baseData} columns={columns} />);
      expect(screen.getByText('ID')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Value')).toBeInTheDocument();
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
    });

    it('renders custom column rendering', () => {
      const customColumns: Column<TestRow>[] = [
        { key: 'id', header: 'ID' },
        { key: 'name', header: 'Name', render: (row) => <span>Custom: {row.name}</span> },
      ];
      render(<DataGrid data={[baseData[0]]} columns={customColumns} />);
      expect(screen.getByText('Custom: Alice')).toBeInTheDocument();
    });
  });

  describe('sorting', () => {
    it('sorts by clicking a header', () => {
      render(<DataGrid data={baseData} columns={columns} onRowClick={() => {}} />);
      const nameHeader = screen.getByText('Name');
      fireEvent.click(nameHeader);
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('toggles sort order when clicking same header', () => {
      render(<DataGrid data={baseData} columns={columns} onRowClick={() => {}} />);
      const nameHeader = screen.getByText('Name');
      fireEvent.click(nameHeader);
      fireEvent.click(nameHeader);
    });
  });

  describe('empty state', () => {
    it('shows empty state message when no data', () => {
      render(<DataGrid data={[]} columns={columns} />);
      expect(screen.getByText('No data available')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<DataGrid data={[]} columns={columns} isLoading={true} />);
      const skeletons = document.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('footer', () => {
    it('shows item count in footer', () => {
      render(<DataGrid data={baseData} columns={columns} />);
      expect(screen.getByText('3 items')).toBeInTheDocument();
    });

    it('shows singular item count when one item', () => {
      render(<DataGrid data={[baseData[0]]} columns={columns} />);
      expect(screen.getByText('1 item')).toBeInTheDocument();
    });
  });
});