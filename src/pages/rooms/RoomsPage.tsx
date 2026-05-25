import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { deleteAdminRoom, getAdminRoomMembers, getAdminRooms, removeAdminUserFromRoom } from '../../api/admin';
import { HttpError } from '../../api/http';
import { useAuth } from '../../features/auth/AuthProvider';
import { connectAdminSocket } from '../../realtime/adminSocket';

function formatDate(d: string | null): string {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '-';
  return dt.toLocaleString();
}

export function RoomsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  const roomsQueryKey = useMemo(
    () => ['adminRooms', { page, pageSize, q: q.trim() || undefined, status: status.trim() || undefined }],
    [page, pageSize, q, status]
  );
  const roomsQuery = useQuery({
    queryKey: roomsQueryKey,
    queryFn: () => getAdminRooms({ page, pageSize, q: q.trim() || undefined, status: status.trim() || undefined }),
    staleTime: 15_000
  });

  const membersQuery = useQuery({
    queryKey: ['adminRoomMembers', { roomId: selectedRoomId }],
    queryFn: () => {
      if (selectedRoomId === null) throw new Error('No room selected');
      return getAdminRoomMembers(selectedRoomId);
    },
    enabled: selectedRoomId !== null,
    staleTime: 10_000
  });

  useEffect(() => {
    const err = roomsQuery.error ?? membersQuery.error;
    if (err instanceof HttpError && err.status === 401) {
      logout();
      navigate('/login', { replace: true });
    }
  }, [logout, membersQuery.error, navigate, roomsQuery.error]);

  useEffect(() => {
    const socket = connectAdminSocket();
    const onRoomDeleted = (payload: { roomId: number }) => {
      queryClient.invalidateQueries({ queryKey: ['adminRooms'] });
      queryClient.invalidateQueries({ queryKey: ['adminRoomMembers'] });
      if (selectedRoomId === payload.roomId) setSelectedRoomId(null);
    };
    const onMemberRemoved = (payload: { roomId: number; userId: number }) => {
      queryClient.invalidateQueries({ queryKey: ['adminRooms'] });
      queryClient.invalidateQueries({ queryKey: ['adminRoomMembers', { roomId: payload.roomId }] });
    };
    socket.on('admin:rooms:deleted', onRoomDeleted);
    socket.on('admin:rooms:member_removed', onMemberRemoved);
    return () => {
      socket.off('admin:rooms:deleted', onRoomDeleted);
      socket.off('admin:rooms:member_removed', onMemberRemoved);
      socket.disconnect();
    };
  }, [queryClient, selectedRoomId]);

  const deleteMutation = useMutation({
    mutationFn: (roomId: number) => deleteAdminRoom(roomId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminRooms'] });
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (payload: { roomId: number; userId: number }) => removeAdminUserFromRoom(payload.roomId, payload.userId),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['adminRooms'] });
      await queryClient.invalidateQueries({ queryKey: ['adminRoomMembers', { roomId: variables.roomId }] });
    }
  });

  const totalPages = roomsQuery.data ? Math.max(1, Math.ceil(roomsQuery.data.total / roomsQuery.data.pageSize)) : 1;

  return (
    <div className="container">
      <div className="card">
        <div className="cardHeader">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Rooms</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Manage public rooms and memberships
            </div>
          </div>
          <div className="row">
            <Link className="button" to="/dashboard">
              Dashboard
            </Link>
            <Link className="button" to="/reports">
              Reports
            </Link>
            <Link className="button" to="/users">
              Users
            </Link>
          </div>
        </div>
        <div className="cardBody" style={{ display: 'grid', gap: 12 }}>
          <div className="row">
            <input
              className="input"
              placeholder="Search by room name…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <select
              className="input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              style={{ width: 180 }}
            >
              <option value="">All</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="deleted">Deleted</option>
            </select>
            <button
              className="button"
              type="button"
              onClick={() => {
                roomsQuery.refetch();
              }}
              disabled={roomsQuery.isFetching}
            >
              {roomsQuery.isFetching ? 'Searching…' : 'Search'}
            </button>
          </div>

          {roomsQuery.isLoading ? <div className="muted">Loading…</div> : null}
          {roomsQuery.isError ? (
            <div className="error">{roomsQuery.error instanceof Error ? roomsQuery.error.message : 'Failed to load rooms'}</div>
          ) : null}

          {roomsQuery.data ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px' }}>ID</th>
                    <th style={{ padding: '10px 8px' }}>Name</th>
                    <th style={{ padding: '10px 8px' }}>Status</th>
                    <th style={{ padding: '10px 8px' }}>Members</th>
                    <th style={{ padding: '10px 8px' }}>Created</th>
                    <th style={{ padding: '10px 8px' }} />
                  </tr>
                </thead>
                <tbody>
                  {roomsQuery.data.items.map((r) => {
                    const isSelected = selectedRoomId === r.id;
                    return (
                      <React.Fragment key={r.id}>
                        <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <td style={{ padding: '10px 8px' }}>{r.id}</td>
                          <td style={{ padding: '10px 8px' }}>
                            <button
                              className="button"
                              type="button"
                              onClick={() => setSelectedRoomId((prev) => (prev === r.id ? null : r.id))}
                              style={{ padding: '6px 10px' }}
                            >
                              {r.name}
                            </button>
                          </td>
                          <td style={{ padding: '10px 8px' }}>{r.status}</td>
                          <td style={{ padding: '10px 8px' }}>{r.memberCount}</td>
                          <td style={{ padding: '10px 8px' }}>{formatDate(r.createdAt)}</td>
                          <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                            <button
                              className="button"
                              type="button"
                              onClick={() => {
                                if (!window.confirm(`Delete room "${r.name}" (id ${r.id})? This removes messages and members.`)) return;
                                deleteMutation.mutate(r.id);
                              }}
                              disabled={deleteMutation.isPending || r.status === 'deleted'}
                            >
                              {deleteMutation.isPending ? 'Deleting…' : r.status === 'deleted' ? 'Deleted' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                        {isSelected ? (
                          <tr style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                            <td colSpan={6} style={{ padding: '12px 8px' }}>
                              <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
                                Room members
                              </div>
                              {membersQuery.isLoading ? <div className="muted">Loading members…</div> : null}
                              {membersQuery.isError ? (
                                <div className="error">
                                  {membersQuery.error instanceof Error ? membersQuery.error.message : 'Failed to load members'}
                                </div>
                              ) : null}
                              {membersQuery.data ? (
                                <div style={{ display: 'grid', gap: 8 }}>
                                  {membersQuery.data.members.length === 0 ? (
                                    <div className="muted">No members</div>
                                  ) : (
                                    membersQuery.data.members.map((m) => (
                                      <div
                                        key={m.id}
                                        className="row"
                                        style={{
                                          padding: '8px 10px',
                                          borderRadius: 10,
                                          border: '1px solid rgba(255,255,255,0.12)',
                                          background: 'rgba(0,0,0,0.12)'
                                        }}
                                      >
                                        <div style={{ fontWeight: 700 }}>{m.user?.username ?? `User ${m.userId}`}</div>
                                        <div className="muted" style={{ fontSize: 12 }}>
                                          {m.user?.email ?? '-'}
                                        </div>
                                        <div className="spacer" />
                                        <button
                                          className="button"
                                          type="button"
                                          onClick={() => {
                                            if (!window.confirm(`Remove user ${m.userId} from room ${r.id}?`)) return;
                                            removeMemberMutation.mutate({ roomId: r.id, userId: m.userId });
                                          }}
                                          disabled={removeMemberMutation.isPending}
                                        >
                                          {removeMemberMutation.isPending ? 'Removing…' : 'Remove'}
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {roomsQuery.data ? (
            <div className="row">
              <div className="muted" style={{ fontSize: 12 }}>
                {roomsQuery.data.total} rooms
              </div>
              <div className="spacer" />
              <button className="button" type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Prev
              </button>
              <div className="muted" style={{ fontSize: 12 }}>
                Page {page} / {totalPages}
              </div>
              <button
                className="button"
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

