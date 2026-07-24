import React, { useState, useEffect } from 'react';
import leaderboardData from '../../mock/leaderboard.json';
import { X, Trophy, TrendingUp, Calendar, Map as MapIcon, Shield } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { UserProfileModal } from './UserProfileModal';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'weekly' | 'guild' | 'monthly' | 'total'>('weekly');
  const [realPlayers, setRealPlayers] = useState<any[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchUsers = async () => {
        try {
          const data = await apiClient('/leaderboard');
          
          const users = data.users.map((u: any) => {
            const emailSum = (u.email || u.username || 'user').split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
            
            return {
              id: u.id,
              name: u.username || (u.email ? u.email.split('@')[0] : 'Unknown Player'),
              avatar: '👤',
              location: [103.64 + (emailSum % 100) * 0.0001, 1.56 + (emailSum % 100) * 0.0001],
              weeklyPoints: u.coins || 0,
              monthlyPoints: u.coins || 0,
              totalMileageKm: u.total_distance_km || 0,
              treesPlanted: u.total_trees_planted || 0,
              guildName: u.guild_id && u.guild_id !== 'None' ? u.guild_id : 'Explorer',
              isRisingStar: emailSum % 2 === 0,
              coins: u.coins
            };
          });
          setRealPlayers(users);
        } catch (err) {
          console.error("Failed to fetch users:", err);
        }
      };
      fetchUsers();
    }
  }, [isOpen]);

  if (!isOpen && !selectedPlayer) return null;

  const { guilds } = leaderboardData;

  const getSortedPlayers = () => {
    const list = [...leaderboardData.players, ...realPlayers];
    const uniqueList = Array.from(new Map(list.map(item => [item.id, item])).values());
    switch (activeTab) {
      case 'weekly':
        return uniqueList.sort((a, b) => b.weeklyPoints - a.weeklyPoints).slice(0, 20);
      case 'monthly':
        return uniqueList.sort((a, b) => b.monthlyPoints - a.monthlyPoints).slice(0, 20);
      case 'total':
        return uniqueList.sort((a, b) => b.totalMileageKm - a.totalMileageKm).slice(0, 20);
      default:
        return uniqueList.slice(0, 20);
    }
  };

  const getSortedGuilds = () => {
    return [...guilds].sort((a, b) => b.power - a.power);
  };

  const handlePlayerClick = (player: any) => {
    setSelectedPlayer(player);
  };

  const renderPlayerList = () => {
    const sorted = getSortedPlayers();
    return (
      <div className="space-y-3 mt-4">
        {sorted.map((player, idx) => (
          <div 
            key={player.id} 
            onClick={() => handlePlayerClick(player)}
            className="flex items-center gap-4 bg-[#e9efce] p-4 rounded-2xl transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white bg-[#5496a2] shadow-sm">
              {idx + 1}
            </div>
            <div className="w-12 h-12 rounded-full bg-[#fff4d6] flex items-center justify-center text-2xl shadow-inner">
              {player.avatar}
            </div>
            <div className="flex-1 overflow-hidden">
              <h3 className="font-bold text-[#1d3539] text-lg truncate">
                {player.name}
              </h3>
              <p className="text-sm font-bold text-[#5496a2] truncate">{player.guildName}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-[#1d3539] text-xl">
                {activeTab === 'weekly' ? player.weeklyPoints : activeTab === 'monthly' ? player.monthlyPoints : Number(player.totalMileageKm).toFixed(2)}
              </p>
              <p className="text-xs font-bold text-[#80abb1] uppercase tracking-wider">
                {activeTab === 'total' ? 'KM' : 'PTS'}
              </p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderGuildList = () => {
    const sampleGuilds = [
      { id: 'g1', name: 'Eco Warriors', treesPlanted: 142, members: 12 },
      { id: 'g2', name: 'Nature Knights', treesPlanted: 98, members: 8 },
      { id: 'g3', name: 'Green Guardians', treesPlanted: 56, members: 5 }
    ];

    return (
      <div className="space-y-4">
        {sampleGuilds.map((guild, index) => (
          <div key={guild.id} className="bg-[#e9efce] rounded-2xl p-4 flex items-center transition-all hover:shadow-md hover:-translate-y-1 cursor-pointer">
            <div className="w-10 text-center text-xl font-black text-[#5496a2]">
              #{index + 1}
            </div>
            <div className="w-12 h-12 bg-[#fff4d6] rounded-xl flex items-center justify-center text-2xl mr-4 shadow-inner">
              🛡️
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-[#1d3539] text-lg">{guild.name}</h4>
              <p className="text-sm font-bold text-[#5496a2]">{guild.members} Active Members</p>
            </div>
            <div className="text-right">
              <div className="font-black text-[#1d3539] text-xl flex items-center justify-end gap-1">
                {guild.treesPlanted} 🌳
              </div>
              <div className="text-xs text-[#80abb1] font-bold uppercase tracking-wider">Trees Planted</div>
            </div>
          </div>
        ))}
        <div className="text-center text-sm font-bold text-[#5496a2] mt-6">
          Guild system and territory wars are coming in the next update!
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
      <div className="bg-[#fff4d6] rounded-[2rem] w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-90 duration-300 relative shadow-2xl border border-white/40">
        
        <div className="bg-[#5496a2] p-5 flex justify-between items-center text-white shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-[#fff4d6]/20 p-2 rounded-xl">
              <Trophy className="text-[#fff4d6]" size={24} />
            </div>
            <h2 className="text-xl font-black uppercase tracking-wider text-white">Leaderboards</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex p-3 bg-[#80abb1] gap-2 overflow-x-auto no-scrollbar shrink-0 shadow-inner">
          <button 
            onClick={() => setActiveTab('weekly')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'weekly' ? 'bg-[#fff4d6] text-[#1d3539] shadow-sm' : 'text-[#e9efce] hover:text-white hover:bg-[#5496a2]/50'}`}
          >
            <TrendingUp size={16} /> Weekly
          </button>
          <button 
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'monthly' ? 'bg-[#fff4d6] text-[#1d3539] shadow-sm' : 'text-[#e9efce] hover:text-white hover:bg-[#5496a2]/50'}`}
          >
            <Calendar size={16} /> Monthly
          </button>
          <button 
            onClick={() => setActiveTab('total')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'total' ? 'bg-[#fff4d6] text-[#1d3539] shadow-sm' : 'text-[#e9efce] hover:text-white hover:bg-[#5496a2]/50'}`}
          >
            <MapIcon size={16} /> All-Time
          </button>
          <button 
            onClick={() => setActiveTab('guild')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${activeTab === 'guild' ? 'bg-[#fff4d6] text-[#1d3539] shadow-sm' : 'text-[#e9efce] hover:text-white hover:bg-[#5496a2]/50'}`}
          >
            <Shield size={16} /> Guilds
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {activeTab === 'guild' ? renderGuildList() : renderPlayerList()}
        </div>

      </div>
      <UserProfileModal isOpen={!!selectedPlayer} onClose={() => setSelectedPlayer(null)} player={selectedPlayer} />
    </div>
  );
};
