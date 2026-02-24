import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { affineFetch } from '../../fetch-utils';
import { Header } from '../header';

type IssueReportRow = {
  id: string;
  workspaceId: string;
  reporterId?: string | null;
  status: string;
  severity: string;
  app: string;
  title?: string | null;
  description: string;
  route?: string | null;
  featureArea?: string | null;
  createdAt: string;
  attachments?: Array<{ key: string; name: string; mime: string; size: number }>;
};

const STATUSES = ['all', 'new', 'triaged', 'in_progress', 'resolved', 'rejected', 'duplicate'] as const;
const SEVERITIES = ['all', 'low', 'medium', 'high', 'critical'] as const;

type StatusFilter = (typeof STATUSES)[number];
type SeverityFilter = (typeof SEVERITIES)[number];

export function ReportsPage() {
  const [status, setStatus] = useState<StatusFilter>('new');
  const [severity, setSeverity] = useState<SeverityFilter>('all');
  const [workspaceId, setWorkspaceId] = useState('');
  const [rows, setRows] = useState<IssueReportRow[]>([]);
  const [selected, setSelected] = useState<IssueReportRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const queryUrl = useMemo(() => {
    const url = new URL(`${location.origin}${environment.subPath}/api/admin/issue-reports`);
    if (workspaceId.trim()) url.searchParams.set('workspaceId', workspaceId.trim());
    if (status !== 'all') url.searchParams.set('status', status);
    if (severity !== 'all') url.searchParams.set('severity', severity);
    url.searchParams.set('take', '100');
    return url.toString();
  }, [workspaceId, status, severity]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    affineFetch(queryUrl)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (!data?.ok) {
          setRows([]);
          setSelected(null);
          return;
        }
        setRows(Array.isArray(data.rows) ? data.rows : []);
        setSelected(prev => {
          if (!prev) return null;
          const next = (Array.isArray(data.rows) ? data.rows : []).find((r: IssueReportRow) => r.id === prev.id);
          return next ?? null;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setSelected(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [queryUrl]);

  return (
    <div className="h-dvh flex-1 flex-col flex overflow-hidden">
      <Header title="Reports" />
      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Card className="border-border/60 bg-card shadow-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Filter by workspace, status, and severity.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Workspace</div>
              <input
                value={workspaceId}
                onChange={e => setWorkspaceId(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
                placeholder="workspaceId…"
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
              <Select value={status} onValueChange={v => setStatus(v as StatusFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Severity</div>
              <Select value={severity} onValueChange={v => setSeverity(v as SeverityFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map(s => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <Card className="border-border/60 bg-card shadow-1 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Inbox</CardTitle>
              <CardDescription>{rows.length} reports</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-8 text-center bg-muted/15">
                  <div className="text-sm font-medium">No reports</div>
                  <div className="text-xs text-muted-foreground mt-2">Try widening filters.</div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map(r => (
                      <TableRow
                        key={r.id}
                        className={`hover:bg-muted/40 cursor-pointer ${selected?.id === r.id ? 'bg-muted/30' : ''}`}
                        onClick={() => setSelected(r)}
                      >
                        <TableCell className="font-mono text-xs">{r.status}</TableCell>
                        <TableCell className="font-mono text-xs">{r.severity}</TableCell>
                        <TableCell className="text-sm">{r.route ?? '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{r.workspaceId}</TableCell>
                        <TableCell className="text-xs">{new Date(r.createdAt).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card shadow-1">
            <CardHeader>
              <CardTitle className="text-base">Detail</CardTitle>
              <CardDescription>{selected ? selected.id : 'Select a report'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {selected ? (
                <>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Title</div>
                    <div className="text-sm font-medium">{selected.title || '(no title)'}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Description</div>
                    <div className="text-sm whitespace-pre-wrap break-words">{selected.description}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Status</div>
                    <Select
                      value={selected.status}
                      onValueChange={async next => {
                        setUpdating(true);
                        try {
                          const res = await affineFetch(
                            `${environment.subPath}/api/admin/issue-reports/${selected.id}/status`,
                            {
                              method: 'POST',
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ status: next }),
                            }
                          );
                          const data = (await res.json()) as any;
                          if (data?.ok && data?.report) {
                            setSelected(data.report);
                          }
                        } finally {
                          setUpdating(false);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.filter(s => s !== 'all').map(s => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {Array.isArray(selected.attachments) && selected.attachments.length ? (
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Attachments</div>
                      <div className="space-y-2">
                        {selected.attachments.map(a => (
                          <Button
                            key={a.key}
                            variant="outline"
                            size="sm"
                            className="w-full justify-between"
                            onClick={() => {
                              window.open(
                                `${environment.subPath}/api/admin/issue-reports/${selected.id}/attachments/${a.key}`,
                                '_blank'
                              );
                            }}
                            disabled={updating}
                          >
                            <span className="truncate">{a.name}</span>
                            <span className="text-xs text-muted-foreground">{a.mime}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">Pick a report from the inbox.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export { ReportsPage as Component };
