"use client";

import React from "react";
import { Card } from "@/components/common/Card";
import { Users, User, Copy } from "lucide-react";
import type { GroupMember } from "@/types";

interface GroupMembersListProps {
  groupName: string;
  inviteCode: string;
  members: GroupMember[];
  currentUserId: string;
}

export const GroupMembersList: React.FC<GroupMembersListProps> = ({
  groupName,
  inviteCode,
  members,
  currentUserId,
}) => {
  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <div>
          <span className="text-[11px] font-semibold tracking-wider text-ink-muted uppercase">
            参加中グループ
          </span>
          <h2 className="font-mincho text-lg font-bold text-ink">
            {groupName}
          </h2>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-paper px-3 py-1 border border-line">
          <Users className="h-3.5 w-3.5 text-ink-muted" />
          <span className="font-number text-xs font-bold text-ink">
            {members.length} / 4人
          </span>
        </div>
      </div>

      {/* 招待コード表示エリア */}
      <div className="flex items-center justify-between rounded-lg bg-highlighter/15 p-3 border border-highlighter/40">
        <div>
          <span className="block text-[10px] font-bold text-ink-muted uppercase">
            招待コード (仲間を招待)
          </span>
          <span className="font-number text-lg font-bold tracking-widest text-ink">
            {inviteCode}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(inviteCode);
            alert("招待コードをコピーしました！");
          }}
          className="inline-flex items-center gap-1 rounded-md bg-paper-card px-2.5 py-1.5 text-xs font-semibold text-ink border border-line shadow-sm hover:bg-paper-hover active:scale-95 transition-all cursor-pointer"
        >
          <Copy className="h-3.5 w-3.5 text-ink-muted" />
          コピー
        </button>
      </div>

      {/* メンバー一覧 */}
      <div>
        <span className="text-xs font-semibold text-ink-muted mb-2 block">
          メンバー一覧
        </span>
        <ul className="space-y-2">
          {members.map((member) => {
            const isMe = member.id === currentUserId;
            return (
              <li
                key={member.id}
                className={`flex items-center justify-between rounded-lg p-2.5 border transition-all ${
                  isMe
                    ? "bg-akashiito-subtle/50 border-akashiito-border"
                    : "bg-paper/50 border-line/60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      isMe
                        ? "bg-akashiito text-white"
                        : "bg-line text-ink-muted"
                    }`}
                  >
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-ink">
                      {member.name}
                    </span>
                    {isMe && (
                      <span className="ml-1.5 text-[10px] font-bold text-akashiito">
                        (あなた)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded px-2 py-0.5 text-[11px] bg-paper-card border border-line text-ink-muted font-medium">
                    {member.wordbooks?.name || "単語帳未設定"}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
};