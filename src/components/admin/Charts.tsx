'use client'

import React from 'react'
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Rectangle
} from 'recharts'

const COLORS = ['#E9E9E2', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export function TopicPieChart({ data }: { data: any[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="var(--color-panel)"
            strokeWidth={4}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} opacity={0.8} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--color-panel)', 
              border: '1px solid var(--bone-15)', 
              borderRadius: 'var(--radius-8)',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
              padding: '8px 12px'
            }}
            itemStyle={{ fontSize: '11px', color: 'var(--bone-100)', fontWeight: 'bold', textTransform: 'uppercase' }}
            labelStyle={{ display: 'none' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function UsageAreaChart({ data }: { data: any[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--bone-10)" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--bone-30)', fontSize: 10, fontWeight: 'bold' }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--bone-30)', fontSize: 10, fontWeight: 'bold' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--color-panel)', 
              border: '1px solid var(--bone-15)', 
              borderRadius: 'var(--radius-8)',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
              padding: '8px 12px'
            }}
            itemStyle={{ fontSize: '11px', color: 'var(--bone-100)', fontWeight: 'bold', textTransform: 'uppercase' }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="#3b82f6" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorCount)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function UsageTypeBarChart({ data }: { data: any[] }) {
  const chartData = data.map((entry, index) => ({
    ...entry,
    name: entry.name.toUpperCase(),
    fill: COLORS[index % COLORS.length]
  }))

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--bone-10)" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'var(--bone-30)', fontSize: 10, fontWeight: '900', letterSpacing: '0.1em' }}
            width={80}
          />
          <Tooltip 
            cursor={{ fill: 'var(--white-overlay)' }}
            contentStyle={{ 
              backgroundColor: 'var(--color-panel)', 
              border: '1px solid var(--bone-15)', 
              borderRadius: 'var(--radius-8)',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.5)',
              padding: '8px 12px'
            }}
            itemStyle={{ fontSize: '11px', color: 'var(--bone-100)', fontWeight: 'bold', textTransform: 'uppercase' }}
            labelClassName="hidden"
          />
          <Bar 
            dataKey="value" 
            radius={[0, 4, 4, 0]} 
            barSize={12}
            opacity={0.8}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
