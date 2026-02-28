import { PointStatus } from '../types';

export const getStatusColor = (status: PointStatus): string => {
  const colors = {
    LEDIG: 'bg-ledig',
    UPPTAGEN: 'bg-upptagen',
    SKRAP: 'bg-skrap',
    KUNDORDER: 'bg-kundorder',
  };
  return colors[status];
};

export const getStatusTextColor = (status: PointStatus): string => {
  const colors = {
    LEDIG: 'text-ledig',
    UPPTAGEN: 'text-upptagen',
    SKRAP: 'text-skrap',
    KUNDORDER: 'text-kundorder',
  };
  return colors[status];
};

export const getStatusBorderColor = (status: PointStatus): string => {
  const colors = {
    LEDIG: 'border-ledig',
    UPPTAGEN: 'border-upptagen',
    SKRAP: 'border-skrap',
    KUNDORDER: 'border-kundorder',
  };
  return colors[status];
};

export const getStatusLabel = (status: PointStatus): string => {
  const labels = {
    LEDIG: 'Ledig',
    UPPTAGEN: 'Upptagen',
    SKRAP: 'Skräp',
    KUNDORDER: 'Kundorder',
  };
  return labels[status];
};
