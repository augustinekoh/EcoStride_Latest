import React, { useEffect, useState } from 'react';
import { auth } from '../../firebase';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { MAPBOX_TOKEN } from '../../lib/mapboxAPI';
import { LayoutDashboard, Mail, Store, Users, FileCheck, Globe, LogOut, RefreshCw, Shield, Link, Copy, Check, MapPin, CalendarRange, AlertTriangle, ChevronDown } from 'lucide-react';
import { apiClient } from '../../lib/api';
import { AdminMessagesModal } from './AdminMessagesModal';
import { MessageAuthorityModal } from './MessageAuthorityModal';
import { AdminCityEvents } from './AdminCityEvents';
import { AdminPhotoProofs } from './AdminPhotoProofs';
import { formatLocation, getCountries, getStatesForCountry, getCitiesForState } from '../../lib/locationData';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['events_parent']);
  const [isAdminMessagesOpen, setIsAdminMessagesOpen] = useState(false);
  const [isMessageAuthorityModalOpen, setIsMessageAuthorityModalOpen] = useState(false);
  const [selectedAuthorityForMessage, setSelectedAuthorityForMessage] = useState<any | null>(null);

  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [readAdminMessageIds, setReadAdminMessageIds] = useState<string[]>([]);
  const [trees, setTrees] = useState<any[]>([]);
  const [signposts, setSignposts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [guilds, setGuilds] = useState<any[]>([]);
  const [resetInterval, setResetInterval] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [editingCoins, setEditingCoins] = useState<{ [uid: string]: number }>({});
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [selectedTree, setSelectedTree] = useState<any | null>(null);
  const [selectedSignpost, setSelectedSignpost] = useState<any | null>(null);
  const [demoRequests, setDemoRequests] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [viewMapLocation, setViewMapLocation] = useState<[number, number] | null>(null);
  
  // Store Management State
  const [storeItems, setStoreItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemPrice, setNewItemPrice] = useState<number | ''>('');
  const [newItemStock, setNewItemStock] = useState<number | ''>('');
  const [newItemIcon, setNewItemIcon] = useState('☕');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemMerchant, setNewItemMerchant] = useState('');
  const [newItemLink, setNewItemLink] = useState('');
  const [newItemProfile, setNewItemProfile] = useState(true);
  
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Mailbox State
  const [mailTarget, setMailTarget] = useState<'all' | 'merchant_all' | 'user' | 'guild'>('all');
  const [mailTargetId, setMailTargetId] = useState('');
  const [mailTitle, setMailTitle] = useState('');
  const [mailContent, setMailContent] = useState('');
  const [expiresForNewUsers, setExpiresForNewUsers] = useState(false);
  const [sentMails, setSentMails] = useState<any[]>([]);
  const [selectedMails, setSelectedMails] = useState<Set<string>>(new Set());
  const [mailFilter, setMailFilter] = useState<'all' | 'admin' | 'system'>('all');

  // Authority Invitation State
  const [authorityInviteEmail, setAuthorityInviteEmail] = useState('');
  const [authorityInviteCountry, setAuthorityInviteCountry] = useState('');
  const [authorityInviteState, setAuthorityInviteState] = useState('');
  const [authorityInviteCity, setAuthorityInviteCity] = useState('');
  const [authorityInviteLink, setAuthorityInviteLink] = useState('');
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [isInvitingAuthority, setIsInvitingAuthority] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      await apiClient('/admin/cleanup', { method: 'POST' }).catch(() => {});
      const [res, settingsRes] = await Promise.all([
        apiClient('/admin/dashboard'),
        apiClient('/settings').catch(() => ({ config: {} }))
      ]);
      
      if (settingsRes && settingsRes.config && settingsRes.config.tree_reset_interval_days !== undefined) {
        setResetInterval(parseInt(settingsRes.config.tree_reset_interval_days));
      }
      
      // Map D1 data to match previous UI state expectations where possible
      setUsers(res.users.map((u: any) => ({ ...u, email: u.email, id: u.id, role: u.role, coins: u.coins })));
      if (res.guilds) setGuilds(res.guilds);
      setTrees(res.trees.map((t: any) => ({ id: t.id, authorId: t.author_id, lat: t.lat, lng: t.lng, plantedAt: t.planted_at, guildId: t.guild_id, guildName: t.guildName })));
      setSignposts(res.signposts.map((s: any) => ({ id: s.id, authorId: s.author_id, lat: s.lat, lng: s.lng, emoji: s.emoji, message: s.message })));
      
      setStoreItems(res.storeItems.map((i: any) => ({ id: i.id, name: i.name, description: i.desc, price: i.price, stock: i.stock, icon: i.icon, category: i.category, merchantId: i.merchant_id })));
      setCategories(res.categories);
      setMerchants(res.merchants.map((m: any) => {
        let loc = null;
        try { loc = m.location ? JSON.parse(m.location) : null; } catch(e){}
        return { id: m.id, storeName: m.store_name, menuLink: m.menu_link, ownerId: m.owner_id, status: m.status, location: loc };
      }));
      
      setApplications(res.applications.filter((a: any) => a.status === 'pending').map((a: any) => {
        let details: any = {};
        try { details = JSON.parse(a.details); } catch(e) {}
        
        const user = res.users.find((u: any) => u.id === a.owner_id);
        return { 
          id: a.id, merchantId: a.owner_id, storeName: details.storeName || 'Unknown Store', menuLink: details.menuLink, type: a.type, vouchers: details.vouchers || [], merchantEmail: user ? user.email : 'Unknown', category: details.category, location: details.location, subscriptionPlan: details.subscriptionPlan || 'N/A', applicantUsername: details.username || 'Unknown', applicantUid: user?.player_id || details.uid || a.owner_id
        };
      }));
      setDemoRequests(res.demoRequests.filter((d: any) => d.status === 'pending'));
      const socialTitles = [
        'Friend Request', 'Friend Request Accepted', 'Friend Request Rejected', 'Friend Request Sent', 'Friend Removed',
        'New Join Request', 'Join Request Approved', 'Join Request Rejected', 'Kicked from Community', 'Promoted to Admin',
        'Community Terminated'
      ];
      
      const filteredSentMails = res.sentMails.filter((m: any) => 
        !socialTitles.includes(m.title) && 
        m.action_type !== 'guild_join_request' && 
        m.action_type !== 'friend_request'
      );

      setSentMails(filteredSentMails.map((m: any) => {
        const u = res.users.find((user: any) => user.id === m.recipient_id);
        const g = res.guilds ? res.guilds.find((guild: any) => guild.id === m.recipient_id) : null;
        return { 
          id: m.id, 
          title: m.title, 
          content: m.content, 
          recipientType: m.recipient_type, 
          recipientId: u?.player_id || m.recipient_id,
          recipientName: m.recipient_name || u?.username || g?.name,
          expiresForNewUsers: m.expires_for_new_users === 1,
          createdAt: m.created_at,
          sender: m.sender
        };
      }));

      try {
        const msgRes = await apiClient('/admin/messages');
        if (msgRes.messages) {
          setAdminMessages(msgRes.messages);
        }
        if (msgRes.read_mail_ids) {
          setReadAdminMessageIds(msgRes.read_mail_ids);
        }
      } catch (e) {}
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleOpenAdminMessages = () => {
    setIsAdminMessagesOpen(true);
  };

  const unreadAdminCount = adminMessages.filter(m => !readAdminMessageIds.includes(m.id)).length;
  const hasUnreadAdmin = unreadAdminCount > 0;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSaveConfig = async () => {
    if (resetInterval > 0) {
      if (!window.confirm("WARNING: Setting this cron job might cause active tree planting activities' total tree calculation to be incorrect. Are you sure you want to proceed?")) {
        return;
      }
    }
    
    setIsSaving(true);
    try {
      await apiClient('/settings', { method: 'POST', body: JSON.stringify({ treeResetInterval: resetInterval }) });
      alert('Settings saved!');
    } catch (err) {
      console.error(err);
      alert('Failed to save settings.');
    }
    setIsSaving(false);
  };

  const handleDeleteTree = async (treeId: string) => {
    if (confirm('Delete this tree?')) {
      await apiClient(`/trees/${treeId}`, { method: 'DELETE' });
      fetchDashboardData();
    }
  };

  const handleDeleteSignpost = async (signpostId: string) => {
    if (confirm('Delete this signpost?')) {
      await apiClient(`/signposts/${signpostId}`, { method: 'DELETE' });
      fetchDashboardData();
    }
  };

  const handleClearAllTrees = async () => {
    if (confirm('Are you SURE you want to delete ALL trees? This cannot be undone.')) {
      try {
        await apiClient('/trees', { method: 'DELETE' });
        fetchDashboardData();
        alert('All trees have been cleared.');
      } catch (err) {
        console.error(err);
        alert('Failed to clear trees.');
      }
    }
  };

  const handleUpdateCoins = async (uid: string) => {
    const newCoins = editingCoins[uid];
    if (newCoins !== undefined) {
      await apiClient(`/users/${uid}`, { method: 'POST', body: JSON.stringify({ coins: newCoins }) });
      alert('User coins updated!');
      fetchDashboardData();
    }
  };

  const handleBanUser = async (uid: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return; // Prompt option

    let bannedUntil = 0;
    if (value === 'unban') {
      bannedUntil = 0;
    } else if (value === 'forever') {
      bannedUntil = 4102444800000; // Year 2100
    } else {
      const days = Number(value);
      bannedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
    }
    
    try {
      await apiClient(`/admin/users/${uid}/ban`, { method: 'POST', body: JSON.stringify({ bannedUntil }) });
      alert(bannedUntil === 0 ? 'User unbanned successfully.' : 'User banned successfully.');
      fetchDashboardData();
    } catch (err: any) {
      alert(`Failed to update ban status: ${err.message}`);
    }
  };

  const handleTerminateCommunity = async (guildId: string) => {
    if (confirm('Are you SURE you want to terminate this community? This cannot be undone.')) {
      try {
        await apiClient(`/admin/guilds/${guildId}`, { method: 'DELETE' });
        alert('Community terminated.');
        fetchDashboardData();
      } catch (err) {
        console.error(err);
        alert('Failed to terminate community.');
      }
    }
  };

  const handleApprove = async (app: any) => {
    try {
      await apiClient(`/applications/${app.id}`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
      
      // Send mail
      await apiClient('/mail', { method: 'POST', body: JSON.stringify({
        title: 'Application Approved 🎉', content: `Your application for ${app.storeName} was approved.`, sender: 'System', recipientType: 'user', recipientId: app.merchantId
      })});
      
      fetchDashboardData();
    } catch (e) { console.error(e); }
  };

  const handleReject = async (app: any) => {
    const reason = window.prompt("Reason for rejecting this application:");
    if (reason === null) return; // User cancelled
    try {
      await apiClient(`/applications/${app.id}`, { method: 'PUT', body: JSON.stringify({ status: 'rejected', rejectReason: reason || 'No specific reason provided.' }) });
      
      await apiClient('/mail', { method: 'POST', body: JSON.stringify({
        title: 'Application Rejected ❌', 
        content: `Your merchant application for ${app.storeName} was rejected. Reason: ${reason || 'No reason provided.'}`, 
        sender: 'System Admin', 
        recipientType: 'user', 
        recipientId: app.merchantId
      })});
      
      fetchDashboardData();
    } catch (e) { console.error(e); }
  };

  const handleDeleteAuthority = async (userId: string) => {
    if (confirm("Are you SURE you want to delete this Authority user? Their Firebase login will be permanently destroyed and their reports will be reassigned to 'Unknown Player'. This action cannot be undone.")) {
      try {
        await apiClient(`/users/${userId}`, { method: 'DELETE' });
        alert('Authority deleted successfully. The email is now free to register again.');
        fetchDashboardData();
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Failed to delete authority.');
      }
    }
  };

  const handleInviteAuthority = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authorityInviteEmail) return;
    
    setIsInvitingAuthority(true);
    setAuthorityInviteLink('');
    setInviteCopied(false);
    setInviteEmailSent(false);
    
    try {
      const res = await apiClient('/admin/invite-authority', { 
        method: 'POST', 
        body: JSON.stringify({ 
          email: authorityInviteEmail, 
          country: authorityInviteCountry || undefined, 
          state: authorityInviteState || undefined, 
          city: authorityInviteCity || undefined 
        }) 
      });
      if (res.registrationUrl) {
        setAuthorityInviteLink(res.registrationUrl);
      }
      if (res.emailSent) {
        setInviteEmailSent(true);
      }
    } catch (err: any) {
      alert(`Failed to generate invite: ${err.message}`);
    } finally {
      setIsInvitingAuthority(false);
    }
  };

  const handleCopyLink = () => {
    if (authorityInviteLink) {
      navigator.clipboard.writeText(authorityInviteLink);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    }
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mailTitle || !mailContent) {
      alert("Please enter title and content.");
      return;
    }
    if ((mailTarget === 'user' || mailTarget === 'guild') && !mailTargetId) {
      alert("Please enter a Target ID.");
      return;
    }

    try {
      await apiClient('/mail', { method: 'POST', body: JSON.stringify({
        recipientType: mailTarget,
        recipientId: mailTarget === 'all' || mailTarget === 'merchant_all' ? null : mailTargetId,
        title: mailTitle,
        content: mailContent,
        sender: 'Admin',
        expiresForNewUsers: mailTarget !== 'user' ? expiresForNewUsers : false
      })});

      setMailTitle('');
      setMailContent('');
      setMailTargetId('');
      alert("Message sent successfully!");
      fetchDashboardData();
    } catch (err: any) {
      alert(`Failed to send mail: ${err.message || 'Unknown error'}`);
    }
  };

  const handleDeleteMail = async (id: string) => {
    if (window.confirm("Are you sure you want to recall/delete this broadcast?")) {
      try {
        await apiClient(`/mail/${id}`, { method: 'DELETE' });
        fetchDashboardData();
        setSelectedMails(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        alert('Broadcast successfully deleted.');
      } catch (err) {
        console.error(err);
        alert('Failed to delete broadcast.');
      }
    }
  };

  const handleBatchDeleteMail = async () => {
    if (selectedMails.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedMails.size} broadcast(s)?`)) {
      try {
        await apiClient('/mail/batch-delete', { method: 'POST', body: JSON.stringify({ ids: Array.from(selectedMails) }) });
        fetchDashboardData();
        setSelectedMails(new Set());
        alert('Broadcasts successfully deleted.');
      } catch (err) {
        console.error(err);
        alert('Failed to delete broadcasts.');
      }
    }
  };

  const handleApproveDemo = async (id: string) => {
    await apiClient(`/demo_requests/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
    fetchDashboardData();
  };

  const handleRejectDemo = async (id: string) => {
    try {
      await apiClient(`/demo_requests/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'rejected' }) });
      fetchDashboardData();
    } catch (err) { console.error(err); }
  };

  const handleDeleteMerchant = async (merchantId: string, ownerId: string) => {
    const reason = window.prompt("Reason for taking down this merchant's shop:");
    if (reason === null) return; // User cancelled
    try {
      // 1. Delete the merchant
      await apiClient(`/merchants/${merchantId}`, { method: 'DELETE' });
      // 2. Send mail to the merchant
      await apiClient('/mail', { method: 'POST', body: JSON.stringify({
        title: 'Merchant Shop Taken Down', 
        content: `Your merchant shop has been taken down by the administrator. Reason: ${reason || 'No reason provided.'}`, 
        sender: 'System Admin', 
        recipientType: 'user', 
        recipientId: ownerId
      })});
      // Role demotion removed per user request: merchants keep their role to apply for a new shop.
      alert('Merchant deleted and notified successfully.');
      fetchDashboardData();
    } catch (err) {
      console.error(err);
      alert('Failed to delete merchant.');
    }
  };

  const handleAddStoreItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemPrice || !newItemStock) return;
    
    const data = {
      itemName: newItemName,
      description: newItemDesc,
      price: Number(newItemPrice),
      stock: Number(newItemStock),
      icon: newItemIcon,
      category: newItemCategory,
      merchantId: newItemMerchant,
      link: newItemLink
    };
    
    if (editingItemId) {
      if (newItemMerchant) {
        const reason = window.prompt("Reason for modifying this voucher:");
        if (reason === null) return; // User cancelled
        await apiClient(`/store/${editingItemId}`, { method: 'PUT', body: JSON.stringify(data) });
        await apiClient('/mail', { method: 'POST', body: JSON.stringify({
          title: 'Voucher Modified 🛠️', 
          content: `Your voucher "${newItemName}" was modified by the administrator. Reason: ${reason || 'No reason provided.'}`, 
          sender: 'System Admin', 
          recipientType: 'user', 
          recipientId: newItemMerchant
        })});
      } else {
        await apiClient(`/store/${editingItemId}`, { method: 'PUT', body: JSON.stringify(data) });
      }
      setEditingItemId(null);
      alert('Store item updated!');
    } else {
      await apiClient('/store', { method: 'POST', body: JSON.stringify(data) });
      alert('Store item added!');
    }
    
    setNewItemName('');
    setNewItemDesc('');
    setNewItemPrice('');
    setNewItemStock('');
    setNewItemIcon('☕');
    setNewItemCategory('');
    setNewItemMerchant('');
    setNewItemLink('');
    setNewItemProfile(true);
    fetchDashboardData();
  };

  const handleEditInit = (item: any) => {
    setEditingItemId(item.id);
    setNewItemName(item.name);
    setNewItemDesc(item.description);
    setNewItemPrice(item.price);
    setNewItemStock(item.stock);
    setNewItemIcon(item.icon);
    setNewItemCategory(item.category || '');
    setNewItemMerchant(item.merchantId || '');
    setNewItemLink(item.link || '');
    setNewItemProfile(!item.merchantId);
  };

  const handleDeleteStoreItem = async (item: any) => {
    if (confirm('Delete this store item?')) {
      if (item.merchantId) {
        const reason = window.prompt("Reason for deleting this voucher:");
        if (reason === null) return; // User cancelled
        await apiClient(`/store/${item.id}`, { method: 'DELETE' });
        await apiClient('/mail', { method: 'POST', body: JSON.stringify({
          title: 'Voucher Deleted 🗑️', 
          content: `Your voucher "${item.name}" was deleted by the administrator. Reason: ${reason || 'No reason provided.'}`, 
          sender: 'System Admin', 
          recipientType: 'user', 
          recipientId: item.merchantId
        })});
      } else {
        await apiClient(`/store/${item.id}`, { method: 'DELETE' });
      }
      if (editingItemId === item.id) setEditingItemId(null);
      fetchDashboardData();
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName) return;
    await apiClient('/store_categories', { method: 'POST', body: JSON.stringify({ name: newCategoryName }) });
    setNewCategoryName('');
    fetchDashboardData();
  };

  const handleDeleteCategory = async (id: string) => {
    alert('Category deletion not implemented via UI for D1 yet.');
  };

  const filteredUsers = users.filter(u => {
    if (!userSearchTerm) return true;
    const term = userSearchTerm.toLowerCase();
    return u.email?.toLowerCase().includes(term) || u.id.toLowerCase().includes(term);
  });

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { 
      id: 'events_parent', 
      label: 'City Events', 
      icon: <CalendarRange size={20} />,
      subItems: [
        { id: 'events', label: 'Event Management' },
        { id: 'photo-proofs', label: 'Photo Proofs' }
      ]
    },
    { id: 'applications', label: 'Applications', icon: <FileCheck size={20} />, badge: applications.length + demoRequests.length },
    { id: 'merchants', label: 'Active Merchants', icon: <Store size={20} /> },
    { id: 'store', label: 'Store Manager', icon: <Store size={20} /> },
    { id: 'users', label: 'Users & Economy', icon: <Users size={20} /> },
    { id: 'authorities', label: 'Authorities', icon: <Shield size={20} />, badge: unreadAdminCount },
    { id: 'broadcasts', label: 'Broadcasts', icon: <Mail size={20} /> },
    { id: 'world', label: 'World Control', icon: <Globe size={20} /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#e6f4f1] via-[#ebf7f5] to-[#d6f0ea] flex font-sans text-[#152c30] relative overflow-hidden">
      
      {/* Decorative Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gradient-to-br from-teal-400/20 to-cyan-300/20 rounded-full blur-[100px] animate-pulse pointer-events-none" style={{ animationDuration: '8s' }}></div>
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-gradient-to-br from-emerald-300/20 to-teal-200/20 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{ animationDuration: '10s' }}></div>

      {/* Sidebar */}
      <div className="w-72 bg-white/40 backdrop-blur-2xl border-r border-white/60 flex flex-col sticky top-0 h-screen shadow-[8px_0_32px_rgba(0,0,0,0.03)] shrink-0 z-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent pointer-events-none"></div>
        <div className="p-8 border-b border-white/40 relative z-10 text-center">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-500 tracking-tighter drop-shadow-sm">EcoStride</h1>
          <p className="text-[10px] font-black text-teal-700/50 uppercase tracking-[0.3em] mt-2">Admin Panel</p>
        </div>
        
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="flex flex-col gap-1 px-3">
            {menuItems.map(item => (
              <div key={item.id}>
                <button
                  onClick={() => {
                    if (item.subItems) {
                      setExpandedMenus(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id]);
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={`flex w-full items-center justify-between px-5 py-4 rounded-2xl font-bold transition-all duration-300 relative overflow-hidden group ${
                    (activeTab === item.id || (item.subItems && item.subItems.find(s => s.id === activeTab))) && !item.subItems
                      ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg shadow-teal-500/20 translate-x-2' 
                      : (item.subItems && item.subItems.find(s => s.id === activeTab))
                        ? 'text-teal-900 bg-white/60'
                        : 'text-teal-800/60 hover:bg-white/60 hover:text-teal-900 hover:translate-x-1'
                  }`}
                >
                  <div className="flex items-center gap-3 relative z-10">
                    {item.icon}
                    {item.label}
                  </div>
                  {item.badge && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
                      {item.badge}
                    </span>
                  )}
                  {item.subItems && (
                    <ChevronDown size={16} className={`transition-transform duration-300 ${expandedMenus.includes(item.id) ? 'rotate-180' : ''}`} />
                  )}
                </button>
                {item.subItems && expandedMenus.includes(item.id) && (
                  <div className="flex flex-col gap-1 mt-1 mb-2 ml-12 border-l-2 border-teal-100 pl-4">
                    {item.subItems.map(sub => (
                      <button
                        key={sub.id}
                        onClick={() => setActiveTab(sub.id)}
                        className={`text-left px-4 py-2 rounded-xl font-bold transition-all duration-200 text-sm ${
                          activeTab === sub.id 
                            ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-md' 
                            : 'text-teal-700/60 hover:text-teal-900 hover:bg-white/50'
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </div>
        
        <div className="p-4 border-t border-slate-100">
          <button 
            onClick={() => auth.signOut()} 
            className="flex items-center gap-2 w-full px-4 py-3 rounded-xl font-bold text-teal-700/70 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut size={20} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto h-screen p-8 bg-transparent">
        <div className="max-w-7xl mx-auto relative">
          
          <div className="flex justify-end mb-4 gap-2 items-center">
            <button 
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center gap-2 bg-white/80 backdrop-blur border border-teal-200 text-teal-800 px-4 py-2 rounded-xl font-bold shadow-sm hover:bg-teal-50 transition-all disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Refreshing...' : 'Refresh Data'}
            </button>
          </div>


          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-3xl font-black text-teal-950 mb-8">Platform Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80">
                  <p className="text-sm font-bold text-teal-700/70 uppercase tracking-wider mb-2">Total Users</p>
                  <p className="text-4xl font-black text-[#111111]">{users.length}</p>
                </div>
                <div className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80">
                  <p className="text-sm font-bold text-teal-700/70 uppercase tracking-wider mb-2">Active Merchants</p>
                  <p className="text-4xl font-black text-emerald-600">{merchants.length}</p>
                </div>
                <div className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80">
                  <p className="text-sm font-bold text-teal-700/70 uppercase tracking-wider mb-2">Planted Trees</p>
                  <p className="text-4xl font-black text-emerald-500">{trees.length}</p>
                </div>
                <div className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80">
                  <p className="text-sm font-bold text-teal-700/70 uppercase tracking-wider mb-2">Active Signposts</p>
                  <p className="text-4xl font-black text-orange-500">{signposts.length}</p>
                </div>
                <div className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80">
                  <p className="text-sm font-bold text-teal-700/70 uppercase tracking-wider mb-2">Active Communities</p>
                  <p className="text-4xl font-black text-purple-600">{guilds.length}</p>
                </div>
              </div>
            </div>
          )}

          {/* EVENTS TAB */}
          {activeTab === 'events' && (
            <AdminCityEvents />
          )}

          {/* PHOTO PROOFS TAB */}
          {activeTab === 'photo-proofs' && (
            <AdminPhotoProofs />
          )}

          {/* APPLICATIONS TAB */}
          {activeTab === 'applications' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-3xl font-black text-teal-950 mb-8">Pending Applications</h2>
              
              <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6 mb-8">
                <h3 className="text-xl font-bold text-teal-950 mb-4 flex items-center gap-2">
                  Merchant Requests <span className="bg-urban-blue/20 text-teal-600 text-xs px-2 py-1 rounded-full">{applications.length}</span>
                </h3>
                
                <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  {loading ? <p className="text-teal-700/70">Loading...</p> : applications.length === 0 ? <p className="text-teal-700/70 italic">No pending applications.</p> : (
                    applications.map((app) => (
                      <div key={app.id} className="bg-transparent p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex-1">
                            <h4 className="font-black text-xl text-[#1d3539]">{app.storeName} <span className="text-sm font-bold text-[#5496a2] ml-2 px-2 py-1 bg-[#5496a2]/10 rounded-full">{app.type === 'modification' ? 'Modification' : 'New Merchant'} - {app.category}</span></h4>
                          <p className="text-sm text-slate-500 font-bold mt-2">Plan: <span className="text-slate-800">{app.subscriptionPlan}</span></p>
                          <p className="text-sm text-slate-500 font-bold mt-1">Applicant: <span className="text-slate-800">{app.applicantUsername}</span> <span className="text-xs text-slate-400 font-mono">({app.applicantUid})</span></p>
                          <p className="text-sm text-slate-500 font-bold mt-1">Email: <span className="text-slate-800">{app.merchantEmail}</span></p>
                          {/* Menu Link & Location Diff */}
                          {(() => {
                            const originalMerchant = app.type === 'modification' ? merchants.find(m => m.ownerId === app.merchantId) : null;
                            const isLinkModified = app.type === 'modification' && originalMerchant && originalMerchant.menuLink !== app.menuLink;
                            const isLocationModified = app.type === 'modification' && originalMerchant && JSON.stringify(originalMerchant.location) !== JSON.stringify(app.location);

                            return (
                              <div className="flex flex-col gap-3 my-4">
                                {/* Menu Link */}
                                {isLinkModified ? (
                                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Link Modified</p>
                                    <p className="text-sm text-slate-400 font-bold line-through decoration-slate-300">Old: {originalMerchant.menuLink || 'N/A'}</p>
                                    <p className="text-sm text-[#1d3539] font-bold">New: <span className="text-blue-600">{app.menuLink || 'N/A'}</span></p>
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-500 font-bold">Link: <span className="text-slate-800">{app.menuLink || 'N/A'}</span></p>
                                )}

                                {/* Location */}
                                {isLocationModified ? (
                                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200">
                                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Location Modified</p>
                                    <div className="flex gap-4 items-center mt-2">
                                      {originalMerchant.location ? (
                                        <button onClick={() => setViewMapLocation(originalMerchant.location)} className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors line-through decoration-slate-400">
                                          📍 Old Location
                                        </button>
                                      ) : <span className="text-xs text-slate-400 font-bold">Old: N/A</span>}
                                      <span className="text-blue-300 font-black">→</span>
                                      {app.location ? (
                                        <button onClick={() => setViewMapLocation(app.location)} className="text-xs font-bold text-white bg-blue-500 px-3 py-1.5 rounded-lg shadow-md shadow-blue-500/20 hover:bg-blue-600 transition-colors">
                                          📍 New Location
                                        </button>
                                      ) : <span className="text-xs text-slate-800 font-bold">New: N/A</span>}
                                    </div>
                                  </div>
                                ) : (
                                  app.location ? (
                                    <button onClick={() => setViewMapLocation(app.location)} className="text-sm font-bold text-[#5496a2] bg-[#5496a2]/10 px-4 py-2 rounded-xl hover:bg-[#5496a2] hover:text-white transition-all active:scale-95 flex items-center gap-2 w-max">
                                      📍 View Location on Map
                                    </button>
                                  ) : (
                                    <p className="text-sm text-slate-400 font-bold">Location: N/A</p>
                                  )
                                )}
                              </div>
                            );
                          })()}
                          
                          {app.vouchers && app.vouchers.length > 0 && (
                            <div className="mt-6 bg-slate-50 p-4 rounded-2xl border-2 border-slate-200">
                              <h5 className="text-xs font-black text-[#1d3539] uppercase tracking-widest mb-3">Vouchers Review</h5>
                              <div className="space-y-3">
                                {app.type !== 'modification' ? (
                                  app.vouchers.map((v: any, vIdx: number) => (
                                    <div key={vIdx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm gap-4">
                                      <div className="flex items-center gap-3">
                                        <span className="text-3xl bg-slate-50 p-2 rounded-xl">{v.icon}</span>
                                        <div>
                                          <p className="font-black text-[#1d3539]">{v.name} <span className="text-xs font-bold text-slate-400 ml-1">x{v.stock}</span></p>
                                          <p className="text-xs font-bold text-slate-500 mt-0.5">{v.desc}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shrink-0">
                                        <span className="font-black text-orange-500 text-lg">🪙{v.price}</span>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  (() => {
                                    const currentMerchantVouchers = storeItems.filter(i => i.merchantId === app.merchantId && i.status !== 'disabled');
                                    const submittedVouchers = app.vouchers || [];
                                    const newVouchers = submittedVouchers.filter((v: any) => !v.originalId);
                                    const deletedVouchers = currentMerchantVouchers.filter((cv: any) => !submittedVouchers.find((sv: any) => sv.originalId === cv.id));
                                    const keptVouchers = submittedVouchers.filter((sv: any) => sv.originalId).map((sv: any) => {
                                      const original = currentMerchantVouchers.find((cv: any) => cv.id === sv.originalId);
                                      return { sv, original };
                                    }).filter((pair: any) => pair.original);

                                    return (
                                      <div className="space-y-4">
                                        {newVouchers.map((v: any, i: number) => (
                                          <div key={`new-${i}`} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-emerald-50 p-3 rounded-xl border border-emerald-200 shadow-sm gap-4 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg">NEW</div>
                                            <div className="flex items-center gap-3">
                                              <span className="text-3xl bg-white p-2 rounded-xl shadow-sm border border-emerald-100">{v.icon}</span>
                                              <div>
                                                <p className="font-black text-[#1d3539]">{v.name} <span className="text-xs font-bold text-slate-400 ml-1">x{v.stock}</span></p>
                                                <p className="text-xs font-bold text-slate-500 mt-0.5">{v.desc}</p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shrink-0">
                                              <span className="font-black text-orange-500 text-lg">🪙{v.price}</span>
                                            </div>
                                          </div>
                                        ))}

                                        {deletedVouchers.map((v: any, i: number) => (
                                          <div key={`del-${i}`} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-red-50 p-3 rounded-xl border border-red-200 shadow-sm gap-4 opacity-60 relative overflow-hidden">
                                            <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg">REMOVED</div>
                                            <div className="flex items-center gap-3 grayscale">
                                              <span className="text-3xl bg-white p-2 rounded-xl border border-red-100">{v.icon}</span>
                                              <div>
                                                <p className="font-black text-[#1d3539] line-through">{v.name} <span className="text-xs font-bold text-slate-400 ml-1">x{v.stock}</span></p>
                                                <p className="text-xs font-bold text-slate-500 mt-0.5 line-through">{v.desc}</p>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shrink-0 grayscale">
                                              <span className="font-black text-orange-500 text-lg">🪙{v.price}</span>
                                            </div>
                                          </div>
                                        ))}

                                        {keptVouchers.map(({ sv, original }: any, i: number) => {
                                          const isModified = sv.name !== original.name || sv.price !== original.price || sv.stock !== original.stock || sv.icon !== original.icon || (sv.desc || sv.description || '') !== (original.desc || original.description || '');
                                          
                                          if (!isModified) {
                                            return (
                                              <div key={`kept-${i}`} className="flex justify-between items-center bg-slate-100/50 p-3 rounded-xl border border-slate-200 opacity-50">
                                                <p className="text-xs font-bold text-slate-400 flex items-center gap-2"><span>{sv.icon}</span> {sv.name} (Unchanged)</p>
                                              </div>
                                            );
                                          }

                                          return (
                                            <div key={`mod-${i}`} className="flex flex-col gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-200 relative overflow-hidden">
                                              <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-black uppercase px-2 py-1 rounded-bl-lg z-10">MODIFIED</div>
                                              
                                              {/* Original State */}
                                              <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 opacity-60">
                                                <div className="flex items-center gap-3">
                                                  <span className="text-2xl bg-white p-2 rounded-xl">{original.icon}</span>
                                                  <div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Original</p>
                                                    <p className="font-bold text-slate-600 line-through decoration-slate-400">{original.name} <span className="text-xs text-slate-400 ml-1">x{original.stock}</span></p>
                                                    <p className="text-xs font-bold text-slate-400 mt-0.5 line-through decoration-slate-300">{original.desc}</p>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1 bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 shrink-0">
                                                  <span className="font-black text-slate-500">🪙{original.price}</span>
                                                </div>
                                              </div>

                                              {/* Arrow */}
                                              <div className="flex justify-center -my-3 relative z-10">
                                                <div className="bg-blue-100 text-blue-500 rounded-full p-1 border-2 border-white">
                                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>
                                                </div>
                                              </div>

                                              {/* New State */}
                                              <div className="bg-white p-3 rounded-lg border border-blue-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                <div className="flex items-center gap-3">
                                                  <span className="text-3xl bg-blue-50 p-2 rounded-xl">{sv.icon}</span>
                                                  <div>
                                                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-0.5">New Change</p>
                                                    <p className="font-black text-[#1d3539]">{sv.name} <span className="text-xs font-bold text-slate-400 ml-1">x{sv.stock}</span></p>
                                                    <p className="text-xs font-bold text-slate-500 mt-0.5">{sv.desc}</p>
                                                  </div>
                                                </div>
                                                <div className="flex items-center gap-1 bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-100 shrink-0">
                                                  <span className="font-black text-orange-500 text-lg">🪙{sv.price}</span>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  })()
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-3 shrink-0 w-full md:w-32 mt-4 md:mt-0">
                          <button onClick={() => handleApprove(app)} className="w-full bg-[#5496a2] text-white font-black px-4 py-3 rounded-xl border-2 border-[#1d3539] shadow-[4px_4px_0px_0px_#1d3539] active:translate-y-1 active:translate-x-1 active:shadow-none transition-all uppercase tracking-wide">Approve</button>
                          <button onClick={() => handleReject(app)} className="w-full bg-red-100 text-red-600 font-black px-4 py-3 rounded-xl border-2 border-red-200 hover:bg-red-200 active:scale-95 transition-all uppercase tracking-wide">Reject</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6">
                <h3 className="text-xl font-bold text-teal-950 mb-4 flex items-center gap-2">
                  Demo Requests <span className="bg-orange-100 text-orange-700 text-xs px-2 py-1 rounded-full">{demoRequests.length}</span>
                </h3>
                
                <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
                  {demoRequests.length === 0 ? <p className="text-teal-700/70 italic">No pending demo requests.</p> : (
                    demoRequests.map((req) => (
                      <div key={req.id} className="bg-transparent p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                        <div>
                          <h4 className="font-bold text-teal-950">{req.email}</h4>
                          <p className="text-xs text-teal-700/70 mt-1">IP: <span className="font-mono text-teal-700/70">{req.ipAddress}</span> | Time: {new Date(req.requestedAt).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => handleRejectDemo(req.id)} className="bg-white border border-red-200 text-red-600 font-bold px-3 py-1.5 text-sm rounded-lg hover:bg-red-50 transition-colors">Reject</button>
                          <button onClick={() => handleApproveDemo(req.id)} className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/20 border-none text-white font-bold px-3 py-1.5 text-sm rounded-lg hover:bg-black shadow-sm transition-colors">Approve</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MERCHANTS TAB */}
          {activeTab === 'merchants' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-3xl font-black text-teal-950 mb-8">Active Merchants</h2>
              
              <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6 mb-8">
                <div className="max-h-[600px] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  {merchants.length === 0 ? <p className="text-teal-700/70 italic">No active merchants.</p> : (
                    merchants.map((m: any) => {
                      const user = users.find(u => u.id === m.ownerId);
                      return (
                        <div key={m.id} className="bg-transparent p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex-1">
                            <h4 className="font-bold text-lg text-[#111111]">{m.storeName}</h4>
                            <p className="text-sm text-slate-600 mt-1">Status: <span className="font-semibold text-emerald-600 uppercase text-xs tracking-wide">{m.status}</span></p>
                            <p className="text-xs text-teal-700/70 mt-1">Owner Email: {user ? user.email : 'Unknown'} | Link: {m.menuLink || 'N/A'}</p>
                            
                            {m.location ? (
                              <button onClick={() => setViewMapLocation(m.location)} className="text-xs font-bold text-[#5496a2] bg-[#5496a2]/10 px-3 py-1.5 rounded-lg hover:bg-[#5496a2] hover:text-white transition-all active:scale-95 flex items-center gap-1 mt-2">
                                📍 View Location on Map
                              </button>
                            ) : (
                              <p className="text-xs text-slate-400 font-bold mt-2">Location: N/A</p>
                            )}
                            
                            {/* Store Items Display */}
                            {storeItems.filter(i => i.merchantId === m.ownerId).length > 0 && (
                              <div className="mt-4 flex flex-col gap-3">
                                {storeItems.filter(i => i.merchantId === m.ownerId).map((item, idx) => (
                                  <div key={idx} className={`border p-3 rounded-xl flex items-center justify-between shadow-sm ${item.status === 'disabled' ? 'bg-slate-50 border-slate-200 opacity-60' : 'bg-white border-slate-200'}`}>
                                    <div className="flex items-center gap-3">
                                      <div className="text-2xl">{item.icon}</div>
                                      <div>
                                        <h4 className="font-bold text-teal-950 text-sm flex items-center gap-2">
                                          {item.name}
                                          {item.status === 'disabled' && <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">Disabled</span>}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1 text-xs font-bold">
                                          <span className="text-orange-500">🪙 {item.price}</span>
                                          <span className={item.stock > 0 ? "text-emerald-500" : "text-red-500"}>📦 {item.stock} left</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={() => handleEditInit(item)} className="text-slate-600 hover:text-teal-600 bg-slate-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Edit</button>
                                      <button onClick={() => handleDeleteStoreItem(item)} className="text-red-500 hover:text-red-700 bg-red-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Delete</button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 shrink-0">
                            {m.status !== 'disabled' && (
                              <button onClick={() => handleDeleteMerchant(m.id, m.ownerId)} className="bg-white border border-red-200 text-red-600 font-bold px-4 py-2 rounded-lg hover:bg-red-50 transition-colors shadow-sm active:translate-y-0.5">Take Down Shop</button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STORE TAB */}
          {activeTab === 'store' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-3xl font-black text-teal-950 mb-8">Store Manager</h2>
              
              <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6 mb-8">
                <h3 className="text-lg font-bold text-teal-950 mb-4">Categories</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  {categories.map(cat => (
                    <span key={cat.id} className="bg-white/60 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 border border-slate-200">
                      {cat.name}
                      <button onClick={() => handleDeleteCategory(cat.id)} className="text-teal-700/70 hover:text-red-500 transition-colors">×</button>
                    </span>
                  ))}
                  <div className="flex gap-2 ml-2">
                    <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="New Category..." className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
                    <button onClick={handleAddCategory} className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/20 border-none text-white font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-black shadow-sm transition-colors">Add</button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 sticky top-0">
                    <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg text-teal-950">Create New Item</h3>
                    </div>
                    <form onSubmit={handleAddStoreItem} className="flex flex-col gap-4">
                      <div>
                        <label className="text-xs font-bold text-teal-700/70 uppercase">Item Name</label>
                        <input required type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" placeholder="e.g. Free Coffee Voucher" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-teal-700/70 uppercase">Description</label>
                        <textarea required value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none h-20" placeholder="Details..." />
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-teal-700/70 uppercase">Price</label>
                          <input required type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-bold text-teal-700/70 uppercase">Stock</label>
                          <input required type="number" value={newItemStock} onChange={e => setNewItemStock(e.target.value === '' ? '' : Number(e.target.value))} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <label className="text-xs font-bold text-teal-700/70 uppercase">Icon (Emoji)</label>
                          <input required type="text" value={newItemIcon} onChange={e => setNewItemIcon(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-center text-lg" />
                        </div>
                        <div className="flex-1">
                          <label className="text-xs font-bold text-teal-700/70 uppercase">Category</label>
                          <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white">
                            <option value="">None</option>
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-teal-700/70 uppercase">Link (Optional)</label>
                        <input type="url" value={newItemLink} onChange={e => setNewItemLink(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" placeholder="https://example.com" />
                      </div>
                      <div className="flex items-center gap-2 py-2">
                        <input type="checkbox" id="profileShow" checked={newItemProfile} onChange={e => setNewItemProfile(e.target.checked)} className="w-4 h-4 text-teal-600 rounded border-slate-300" />
                        <label htmlFor="profileShow" className="text-sm font-bold text-slate-700">Display item in user's profile</label>
                      </div>
                      <button type="submit" className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/20 border-none text-white font-bold py-3 rounded-xl mt-2 hover:bg-black shadow-sm transition-colors">
                        Add Item
                      </button>
                    </form>
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <div className="bg-white/60 backdrop-blur-lg p-6 rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80">
                    <h3 className="font-bold text-lg text-teal-950 mb-6">Inventory Grid</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                      {storeItems.filter(i => !i.merchantId).length === 0 && <p className="text-teal-700/70 italic">No platform items in the store yet.</p>}
                      {storeItems.filter(item => !item.merchantId).map(item => (
                        <div key={item.id} className="bg-white border border-slate-200 p-4 rounded-xl flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
                          {item.stock <= 0 && <div className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-bl-lg tracking-wider">OUT OF STOCK</div>}
                          <div className="flex gap-4">
                            <div className="text-3xl bg-transparent p-3 rounded-xl h-fit border border-slate-100">{item.icon}</div>
                            <div className="min-w-0 flex-1">
                              <h4 className="font-bold text-teal-950 truncate flex items-center gap-2">
                                {item.name}
                                {item.status === 'disabled' && <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">Disabled</span>}
                              </h4>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.category && <span className="bg-teal-500/15 text-teal-700 shadow-sm border border-teal-500/20 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">{item.category}</span>}
                                {item.merchantId && <span className="bg-emerald-50 text-emerald-600 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded">Linked</span>}
                              </div>
                              <p className="text-xs text-teal-700/70 mt-2 line-clamp-2">{item.description}</p>
                              <div className="flex items-center gap-3 mt-3 text-xs font-bold">
                                <span className="text-orange-500">🪙 {item.price}</span>
                                <span className={item.stock > 0 ? "text-emerald-500" : "text-red-500"}>📦 {item.stock} left</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                            <button onClick={() => handleEditInit(item)} className="flex-1 bg-transparent hover:bg-white/60 text-slate-700 py-1.5 rounded-lg font-bold text-xs transition-colors border border-slate-200">
                              Edit
                            </button>
                            <button onClick={() => handleDeleteStoreItem(item)} className="flex-1 bg-white hover:bg-red-50 text-red-500 hover:text-red-600 py-1.5 rounded-lg font-bold text-xs transition-colors border border-red-100">
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS TAB */}
          {activeTab === 'users' && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-3xl font-black text-teal-950">User Economy</h2>
                <input 
                  type="text" 
                  placeholder="Search email or ID..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 w-64 shadow-sm"
                />
              </div>
              
              <div className="mb-8 bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 overflow-hidden">
                <div className="max-h-[700px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/95 backdrop-blur-sm sticky top-0 z-20 border-b border-teal-100 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider">User</th>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider">Role</th>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider">Stats</th>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider">Coins</th>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-50">
                      {filteredUsers.length === 0 && (
                        <tr><td colSpan={5} className="px-6 py-8 text-center text-teal-700/70 italic">No users found.</td></tr>
                      )}
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-white/40 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-teal-950 text-sm truncate max-w-[150px]">{u.username || 'Unknown'}</span>
                                <span className="text-[10px] font-black font-mono text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">ID: {u.player_id || 'N/A'}</span>
                              </div>
                              <div className="text-xs text-teal-700 truncate max-w-[200px]">{u.email}</div>
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">UID: {u.id}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                              u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                              u.role === 'merchant' ? 'bg-emerald-100 text-emerald-700' :
                              'bg-white/60 text-slate-600'
                            }`}>
                              {u.role || 'user'}
                            </span>
                            {u.banned_until > Date.now() && (
                              <div className="mt-2 inline-block bg-red-100 text-red-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                Banned
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-xs text-slate-600">Trees: <span className="font-bold text-teal-950">{u.totalTreesPlanted || 0}</span></div>
                            <div className="text-xs text-slate-600">Saved: <span className="font-bold text-teal-950">{u.totalCarbonSaved || 0}g</span></div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-orange-500 font-black">🪙</span>
                              <input 
                                type="number" 
                                className="w-20 bg-white border border-slate-300 rounded-md px-2 py-1 text-sm font-bold text-teal-950 outline-none focus:border-teal-500"
                                value={editingCoins[u.id] !== undefined ? editingCoins[u.id] : (u.coins || 0)}
                                onChange={(e) => setEditingCoins({...editingCoins, [u.id]: Number(e.target.value)})}
                              />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex flex-col gap-2 items-end">
                              <button 
                                onClick={() => handleUpdateCoins(u.id)}
                                className="w-full bg-teal-500/15 text-teal-700 shadow-sm border border-teal-500/20 hover:bg-urban-blue/20 hover:text-teal-600 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors"
                              >
                                Save Coins
                              </button>
                              <select
                                onChange={(e) => handleBanUser(u.id, e)}
                                value=""
                                className="w-full bg-red-50 text-red-600 font-bold border border-red-200 px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer hover:bg-red-100 transition-colors"
                              >
                                <option value="" disabled>{u.banned_until > Date.now() ? 'Manage Ban' : 'Ban User'}</option>
                                {u.banned_until > Date.now() && <option value="unban">Unban Now</option>}
                                <option value="1">Ban for 1 Day</option>
                                <option value="7">Ban for 7 Days</option>
                                <option value="30">Ban for 30 Days</option>
                                <option value="180">Ban for Half Year</option>
                                <option value="365">Ban for 1 Year</option>
                                <option value="forever">Permanent Ban</option>
                              </select>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 overflow-hidden">
                <div className="p-6 border-b border-teal-100 bg-white/60 backdrop-blur-md">
                  <h3 className="text-xl font-bold text-teal-950">Active Communities</h3>
                </div>
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/95 backdrop-blur-sm sticky top-0 z-20 border-b border-teal-100 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider">Icon</th>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider">Community</th>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider">Access</th>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider">Total Members</th>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider">Admin</th>
                        <th className="px-6 py-4 font-black text-teal-800 uppercase text-xs tracking-wider text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-teal-50">
                      {guilds.length === 0 && (
                        <tr><td colSpan={6} className="px-6 py-8 text-center text-teal-700/70 italic">No communities found.</td></tr>
                      )}
                      {guilds.map(g => (
                        <tr key={g.id} className="hover:bg-transparent/50 transition-colors">
                          <td className="px-6 py-4 text-3xl text-center w-16">
                            {g.icon ? (
                              (g.icon.startsWith('http') || g.icon.startsWith('/')) ? (
                                <div className="w-12 h-12 rounded-xl overflow-hidden mx-auto bg-slate-100">
                                  <img src={g.icon} alt={g.name} className="w-full h-full object-cover" />
                                </div>
                              ) : (
                                g.icon
                              )
                            ) : (
                              '🌍'
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-bold text-teal-950 text-base">{g.name}</div>
                            <div className="text-xs text-teal-700/70 font-mono mt-0.5">UID: {g.id}</div>
                            {g.nationality && <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">{g.nationality}</div>}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-bold px-3 py-1 rounded-full text-xs ${g.require_approval ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>
                              {g.require_approval ? 'Approval Required' : 'Free to Join'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="bg-teal-100 text-teal-800 font-black px-3 py-1 rounded-full">{g.member_count || 0}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-teal-950">
                                {users.find(u => u.id === g.admin_id)?.username || 'No Admin'}
                              </span>
                              <div className="text-[10px] text-teal-700/50 truncate max-w-[120px]" title={g.admin_id}>{g.admin_id || 'N/A'}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button 
                              onClick={() => handleTerminateCommunity(g.id)}
                              className="bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white border border-red-500/20 hover:border-red-500 font-bold px-4 py-1.5 rounded-lg text-xs transition-colors"
                            >
                              Terminate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* AUTHORITIES TAB */}
          {activeTab === 'authorities' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-3xl font-black text-teal-950 mb-8">Authorities Management</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6 h-fit">
                  <h3 className="text-xl font-bold text-teal-950 mb-6 flex items-center gap-2">
                    <Shield size={24} className="text-teal-600" /> Invite Authority
                  </h3>
                  <p className="text-sm text-teal-700/70 mb-6">
                    Generate a one-time registration link for a local government authority. The link will expire in 7 days.
                  </p>
                  
                  <form onSubmit={handleInviteAuthority} className="flex flex-col gap-5">
                    <div>
                      <label className="block text-xs font-bold text-teal-700/70 uppercase tracking-wider mb-2">Authority Official Email</label>
                      <input 
                        type="email" 
                        required
                        value={authorityInviteEmail}
                        onChange={(e) => setAuthorityInviteEmail(e.target.value)}
                        placeholder="e.g. official@citycouncil.gov"
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-teal-950 outline-none focus:border-teal-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-teal-700/70 uppercase tracking-wider mb-2">Assigned Country (Optional)</label>
                      <select 
                        value={authorityInviteCountry}
                        onChange={(e) => {
                          setAuthorityInviteCountry(e.target.value);
                          setAuthorityInviteState('');
                          setAuthorityInviteCity('');
                        }}
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-teal-950 outline-none focus:border-teal-500 appearance-none cursor-pointer"
                      >
                        <option value="">Select a Country...</option>
                        {getCountries().map(c => <option key={c.isoCode} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>

                    {authorityInviteCountry && (
                      <div>
                        <label className="block text-xs font-bold text-teal-700/70 uppercase tracking-wider mb-2">Assigned State (Optional)</label>
                        <select 
                          value={authorityInviteState}
                          onChange={(e) => {
                            setAuthorityInviteState(e.target.value);
                            setAuthorityInviteCity('');
                          }}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-teal-950 outline-none focus:border-teal-500 appearance-none cursor-pointer"
                        >
                          <option value="">Select a State...</option>
                          {getStatesForCountry(authorityInviteCountry).map(s => <option key={s.isoCode} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                    )}

                    {authorityInviteCountry && authorityInviteState && (
                      <div>
                        <label className="block text-xs font-bold text-teal-700/70 uppercase tracking-wider mb-2">Assigned City (Optional)</label>
                        <select 
                          value={authorityInviteCity}
                          onChange={(e) => setAuthorityInviteCity(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-teal-950 outline-none focus:border-teal-500 appearance-none cursor-pointer"
                        >
                          <option value="">Select a City...</option>
                          {getCitiesForState(authorityInviteCountry, authorityInviteState).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                    
                    <button 
                      type="submit"
                      disabled={isInvitingAuthority || !authorityInviteEmail}
                      className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20 border-none text-white font-black px-6 py-3.5 rounded-xl transition-colors mt-2 flex justify-center items-center gap-2"
                    >
                      {isInvitingAuthority ? 'Sending...' : 'Send Email & Generate Link'}
                      <Link size={18} />
                    </button>
                  </form>

                  {authorityInviteLink && (
                    <div className="mt-6 p-4 bg-teal-50 border border-teal-200 rounded-xl animate-in zoom-in duration-300">
                      {inviteEmailSent && (
                        <div className="mb-3 p-3 bg-green-100 text-green-800 rounded-lg text-sm font-bold flex items-center gap-2">
                          <Check size={16} /> Official invitation email sent to {authorityInviteEmail}!
                        </div>
                      )}
                      <p className="text-xs font-bold text-teal-800 uppercase tracking-wider mb-2">Registration Link</p>
                      <div className="flex gap-2 items-center">
                        <input 
                          type="text" 
                          readOnly
                          value={authorityInviteLink}
                          className="flex-1 bg-white border border-teal-200 rounded-lg px-3 py-2 text-sm text-teal-900 outline-none select-all"
                        />
                        <button 
                          onClick={handleCopyLink}
                          className="bg-teal-600 hover:bg-teal-700 text-white p-2 rounded-lg transition-colors flex shrink-0"
                          title="Copy to clipboard"
                        >
                          {inviteCopied ? <Check size={18} /> : <Copy size={18} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-teal-600 mt-2 font-medium">
                        {inviteEmailSent 
                          ? "The system has sent an email automatically. You can also manually copy and send this backup link securely to the authority. They must use the EXACT same email to register."
                          : "Send this link securely to the authority. They must use the EXACT same email to register."}
                      </p>
                    </div>
                  )}
                </div>

                <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-teal-950 flex items-center gap-2">
                      <Users size={24} className="text-teal-600" /> Active Authorities
                    </h3>
                    <button 
                      onClick={handleOpenAdminMessages}
                      className="relative flex items-center gap-2 bg-teal-50 text-teal-700 hover:bg-teal-100 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors border border-teal-200"
                    >
                      <Mail size={16} />
                      <span>Messages</span>
                      {hasUnreadAdmin && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                      )}
                    </button>
                  </div>
                  
                  <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[500px] pr-2 custom-scrollbar">
                    {users.filter(u => u.role === 'authority').length === 0 ? (
                      <div className="text-center py-8 text-teal-700/50 italic border-2 border-dashed border-teal-200/50 rounded-2xl">
                        No active authorities registered yet.
                      </div>
                    ) : (
                      users.filter(u => u.role === 'authority').map((u) => (
                        <div key={u.id} className="bg-white border border-teal-100 p-4 rounded-2xl flex items-center gap-4 hover:shadow-md transition-all group relative overflow-hidden">
                          <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden">
                            {u.avatar ? <img src={u.avatar} alt={u.username} className="w-full h-full object-cover" /> : <Shield size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-teal-950 truncate flex items-center gap-2">
                              {u.username}
                              {u.banned_until > Date.now() && <span className="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded-md uppercase tracking-wider">Banned</span>}
                            </h4>
                            <p className="text-xs text-teal-700/70 truncate">{u.position || 'Local Government'}</p>
                            <div className="flex items-center gap-1 text-[11px] text-teal-600/90 font-medium truncate mt-0.5">
                              <MapPin size={11} className="shrink-0 text-teal-600" />
                              <span>{formatLocation(u.city, u.state, u.country) || 'Jurisdiction Unassigned'}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono truncate mt-0.5">{u.email}</p>
                          </div>
                          <div className="shrink-0 flex gap-2">
                            <button 
                              onClick={() => {
                                setSelectedAuthorityForMessage(u);
                                setIsMessageAuthorityModalOpen(true);
                              }}
                              className="text-teal-600 hover:text-teal-800 hover:bg-teal-50 p-2 rounded-lg transition-colors border border-transparent hover:border-teal-200"
                              title="Direct Message to Authority"
                            >
                              <Mail size={16} />
                            </button>
                            <select
                                onChange={(e) => handleBanUser(u.id, e)}
                                value=""
                                className="bg-red-50 text-red-600 font-bold border border-red-200 px-2 py-1 rounded-lg text-[10px] uppercase outline-none cursor-pointer hover:bg-red-100 transition-colors w-24 text-center"
                              >
                                <option value="" disabled>{u.banned_until > Date.now() ? 'Ban' : 'Ban'}</option>
                                <option value="unban">Unban</option>
                                <option value="365">1 Year</option>
                                <option value="forever">Permanent</option>
                              </select>
                              <button
                                onClick={() => handleDeleteAuthority(u.id)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors border border-transparent hover:border-red-200 text-xs font-bold w-20 text-center uppercase flex items-center justify-center"
                                title="Permanently Delete Authority"
                              >
                                Delete
                              </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BROADCASTS TAB */}
          {activeTab === 'broadcasts' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-3xl font-black text-teal-950 mb-8">Broadcast Center</h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6 h-fit">
                  <h3 className="text-xl font-bold text-teal-950 mb-6 flex items-center gap-2">
                    <Mail size={24} className="text-teal-600" /> Compose Message
                  </h3>
                  <form onSubmit={handleSendMail} className="flex flex-col gap-5">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <label className="block text-xs font-bold text-teal-700/70 uppercase tracking-wider mb-2">Target Audience</label>
                        <select 
                          value={mailTarget}
                          onChange={(e) => setMailTarget(e.target.value as any)}
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-teal-950 font-bold outline-none focus:border-teal-500"
                        >
                          <option value="all">All Users</option>
                          <option value="merchant_all">All Merchants</option>
                          <option value="user">Specific User (UID)</option>
                          <option value="guild">Specific Guild (ID)</option>
                        </select>
                      </div>
                      
                      {(mailTarget === 'user' || mailTarget === 'guild') && (
                        <div className="flex-1">
                          <label className="block text-xs font-bold text-teal-700/70 uppercase tracking-wider mb-2">Target ID</label>
                          <input 
                            type="text" 
                            value={mailTargetId}
                            onChange={(e) => setMailTargetId(e.target.value)}
                            placeholder={mailTarget === 'user' ? "Username or UID..." : "Guild ID..."}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-teal-950 font-bold outline-none focus:border-teal-500"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-teal-700/70 uppercase tracking-wider mb-2">Message Title</label>
                      <input 
                        type="text" 
                        value={mailTitle}
                        onChange={(e) => setMailTitle(e.target.value)}
                        placeholder="e.g. Server Maintenance..."
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-teal-950 outline-none focus:border-teal-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-bold text-teal-700/70 uppercase tracking-wider mb-2">Content</label>
                      <textarea 
                        value={mailContent}
                        onChange={(e) => setMailContent(e.target.value)}
                        placeholder="Type your message here..."
                        rows={5}
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-teal-950 outline-none focus:border-teal-500 resize-none"
                      />
                    </div>
                    
                    <div className="flex items-center gap-2 bg-transparent p-3 rounded-lg border border-slate-200">
                      <input 
                        type="checkbox" 
                        id="expiresForNew"
                        checked={expiresForNewUsers}
                        onChange={(e) => setExpiresForNewUsers(e.target.checked)}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300"
                        disabled={mailTarget === 'user'}
                      />
                      <label htmlFor="expiresForNew" className={`text-sm font-bold ${mailTarget === 'user' ? 'text-teal-700/70' : 'text-slate-700'}`}>
                        Only send to currently registered users (Future users won't see this)
                      </label>
                    </div>
                    
                    <button 
                      type="submit"
                      className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/20 border-none text-white font-black px-6 py-3.5 rounded-xl hover:bg-black transition-colors shadow-sm mt-2"
                    >
                      Send Broadcast 📤
                    </button>
                  </form>
                </div>

                <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6 flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-teal-950">Sent Broadcasts</h3>
                    <div className="flex items-center gap-1 bg-teal-50 p-1 rounded-xl border border-teal-100/50">
                      <button onClick={() => setMailFilter('all')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${mailFilter === 'all' ? 'bg-white shadow-sm text-teal-900 border border-teal-200' : 'text-teal-600/70 hover:text-teal-900 hover:bg-white/50'}`}>All</button>
                      <button onClick={() => setMailFilter('admin')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${mailFilter === 'admin' ? 'bg-white shadow-sm text-teal-900 border border-teal-200' : 'text-teal-600/70 hover:text-teal-900 hover:bg-white/50'}`}>Admin</button>
                      <button onClick={() => setMailFilter('system')} className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${mailFilter === 'system' ? 'bg-white shadow-sm text-teal-900 border border-teal-200' : 'text-teal-600/70 hover:text-teal-900 hover:bg-white/50'}`}>System</button>
                    </div>
                  </div>
                  
                  {selectedMails.size > 0 && (
                    <div className="mb-4">
                      <button 
                        onClick={handleBatchDeleteMail}
                        className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-4 py-2 rounded-xl text-xs font-bold transition-colors border border-red-200 shadow-sm"
                      >
                        Delete Selected ({selectedMails.size})
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[600px] pr-2 custom-scrollbar">
                    {(() => {
                      const displayedMails = sentMails.filter(m => {
                        if (mailFilter === 'all') return true;
                        const isSystem = m.sender === 'System' || m.sender === 'System Admin';
                        if (mailFilter === 'system') return isSystem;
                        if (mailFilter === 'admin') return !isSystem;
                        return true;
                      });

                      if (displayedMails.length === 0) {
                        return <p className="text-teal-700/70 italic">No broadcasts sent yet.</p>;
                      }

                      return displayedMails.map(mail => (
                        <div key={mail.id} className={`rounded-xl p-4 border relative group transition-colors flex gap-4 ${selectedMails.has(mail.id) ? 'bg-teal-50 border-teal-300' : 'bg-transparent border-slate-200 hover:border-slate-300'}`}>
                          <div className="flex flex-col items-center justify-start pt-1">
                            <input 
                              type="checkbox" 
                              checked={selectedMails.has(mail.id)}
                              onChange={(e) => {
                                const next = new Set(selectedMails);
                                if (e.target.checked) next.add(mail.id);
                                else next.delete(mail.id);
                                setSelectedMails(next);
                              }}
                              className="w-5 h-5 text-teal-600 rounded border-slate-300 cursor-pointer"
                            />
                          </div>
                          <div className="flex-1">
                            <button 
                              onClick={() => handleDeleteMail(mail.id)}
                              className="absolute top-4 right-4 bg-white border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 px-3 py-1 rounded-lg text-xs font-bold transition-colors opacity-0 group-hover:opacity-100"
                            >
                              Recall / Delete
                            </button>
                            
                            <h4 className="font-bold text-teal-950 flex items-center flex-wrap gap-2 pr-24">
                              {mail.title} 
                              {mail.sender === 'System' || mail.sender === 'System Admin' ? (
                                <span className="text-[9px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider whitespace-nowrap shrink-0">System Generated</span>
                              ) : (
                                <span className="text-[9px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider whitespace-nowrap shrink-0">Admin Broadcast</span>
                              )}
                              {mail.expiresForNewUsers ? (
                                <span className="text-[9px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider whitespace-nowrap shrink-0">Current Users Only</span>
                              ) : (
                                <span className="text-[9px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider whitespace-nowrap shrink-0">Current & Future</span>
                              )}
                            </h4>
                            <p className="text-xs text-teal-700/70 mt-1 font-bold">
                              To: {mail.recipientType === 'all' ? 'All Users' : mail.recipientType === 'merchant_all' ? 'All Merchants' : mail.recipientType === 'user' || mail.recipientType === 'specific_user' ? `${mail.recipientName || 'Unknown User'} (${mail.recipientId || 'N/A'})` : mail.recipientType === 'guild' ? `${mail.recipientName || 'Unknown Guild'} (${mail.recipientId || 'N/A'})` : mail.recipientType}
                            </p>
                            <p className="text-sm text-slate-600 mt-3 line-clamp-3 leading-relaxed">{mail.content}</p>
                            <p className="text-[10px] font-bold text-teal-700/70 mt-3 uppercase tracking-wider">{new Date(mail.createdAt).toLocaleString()}</p>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WORLD CONTROL TAB */}
          {activeTab === 'world' && (
            <div className="animate-in fade-in duration-300">
              <h2 className="text-3xl font-black text-teal-950 mb-8">World Control</h2>
              
              <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6 mb-8 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-teal-950">Global Game Settings</h3>
                  <p className="text-sm text-teal-700/70">Configure global mechanics</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-bold text-slate-700 pl-2">Tree Reset Interval (Days, 0 = Never):</label>
                  <input 
                    type="number" 
                    min="0"
                    value={resetInterval} 
                    onChange={(e) => setResetInterval(Number(e.target.value))}
                    className="w-20 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-center text-teal-950 font-bold outline-none focus:border-teal-500"
                  />
                  <button 
                    onClick={handleSaveConfig}
                    className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/20 border-none text-white font-bold px-5 py-1.5 rounded-lg hover:bg-black transition-colors shadow-sm"
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="bg-white/60 backdrop-blur-lg rounded-3xl shadow-xl shadow-teal-900/5 border border-white/80 p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-bold text-teal-950 text-lg">Interactive Map Manager</h3>
                    <p className="text-sm text-teal-700/70">Click on any marker to manage it</p>
                  </div>
                  <button 
                    onClick={handleClearAllTrees}
                    className="bg-white border border-red-200 text-red-600 font-bold px-4 py-2 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    Force Clear All Trees
                  </button>
                </div>
                
                <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-slate-200 relative shadow-inner">
                  <Map
                    mapboxAccessToken={MAPBOX_TOKEN}
                    initialViewState={{
                      longitude: 103.6400,
                      latitude: 1.5600,
                      zoom: 14,
                      pitch: 45
                    }}
                    mapStyle="mapbox://styles/mapbox/light-v11"
                  >
                    {trees.map((tree) => (
                      <Marker
                        key={tree.id}
                        longitude={tree.lng}
                        latitude={tree.lat}
                        onClick={(e) => {
                          e.originalEvent.stopPropagation();
                          setSelectedTree(tree);
                          setSelectedSignpost(null);
                        }}
                      >
                        <div className="text-3xl cursor-pointer hover:scale-125 transition-transform origin-bottom drop-shadow-md">
                          🌳
                        </div>
                      </Marker>
                    ))}
                    
                    {signposts.map((post) => (
                      <Marker
                        key={post.id}
                        longitude={post.lng}
                        latitude={post.lat}
                        onClick={(e) => {
                          e.originalEvent.stopPropagation();
                          setSelectedSignpost(post);
                          setSelectedTree(null);
                        }}
                      >
                        <div className="text-3xl cursor-pointer hover:scale-125 transition-transform origin-bottom drop-shadow-md">
                          🪧
                        </div>
                      </Marker>
                    ))}
                    
                    {selectedSignpost && (
                      <Popup
                        longitude={selectedSignpost.lng}
                        latitude={selectedSignpost.lat}
                        anchor="bottom"
                        onClose={() => setSelectedSignpost(null)}
                        closeOnClick={false}
                        className="rounded-2xl overflow-hidden"
                      >
                        <div className="p-4 w-64">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="text-4xl">{selectedSignpost.emoji}</span>
                            <div>
                              <h3 className="font-bold text-slate-800">Signpost</h3>
                              <p className="text-xs text-slate-500">Author ID: {selectedSignpost.authorId}</p>
                            </div>
                          </div>
                          <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 text-sm mb-4 leading-relaxed">
                            "{selectedSignpost.message}"
                          </p>
                          <button
                            onClick={() => {
                              handleDeleteSignpost(selectedSignpost.id);
                              setSelectedSignpost(null);
                            }}
                            className="w-full bg-red-50 text-red-600 font-bold py-2 rounded-xl border border-red-100 hover:bg-red-100 transition-colors"
                          >
                            Delete Signpost
                          </button>
                        </div>
                      </Popup>
                    )}

                    {selectedTree && (
                      <Popup
                        longitude={selectedTree.lng}
                        latitude={selectedTree.lat}
                        anchor="bottom"
                        onClose={() => setSelectedTree(null)}
                        className="admin-popup"
                      >
                        <div className="p-3 text-teal-950 min-w-[200px] font-sans">
                          <h3 className="font-black text-lg text-emerald-600 mb-2">Tree Data</h3>
                          <p className="text-sm text-slate-600 mb-1">Guild: <span className="font-bold text-teal-950">{selectedTree.guildName || 'None'}</span></p>
                          <p className="text-xs text-teal-700/70 truncate" title={selectedTree.authorId}>Planter: <span className="font-mono">{selectedTree.authorId}</span></p>
                          <p className="text-xs text-teal-700/70 mb-4">{new Date(selectedTree.plantedAt).toLocaleString()}</p>
                          <button 
                            onClick={() => {
                              handleDeleteTree(selectedTree.id);
                              setSelectedTree(null);
                            }}
                            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-lg transition-colors shadow-sm"
                          >
                            Delete Tree
                          </button>
                        </div>
                      </Popup>
                    )}
                  </Map>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      
      {viewMapLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setViewMapLocation(null)}>
          <div className="bg-white p-6 rounded-3xl w-[calc(100%-8px)] sm:w-full max-w-2xl border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] relative animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <button onClick={() => setViewMapLocation(null)} className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full w-8 h-8 flex items-center justify-center font-bold active:scale-95 transition-all">✕</button>
            <h3 className="text-xl font-black text-[#1d3539] uppercase mb-4">Merchant Location</h3>
            <div className="w-full h-80 rounded-2xl border-4 border-[#1d3539] overflow-hidden">
              <Map
                initialViewState={{
                  longitude: viewMapLocation[0],
                  latitude: viewMapLocation[1],
                  zoom: 14
                }}
                mapStyle="mapbox://styles/mapbox/outdoors-v12"
                mapboxAccessToken={MAPBOX_TOKEN}
              >
                <Marker longitude={viewMapLocation[0]} latitude={viewMapLocation[1]} anchor="bottom">
                  <div className="text-4xl drop-shadow-md">📍</div>
                </Marker>
              </Map>
            </div>
            <div className="mt-4 flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
              <span className="text-sm font-bold text-slate-500">Coordinates:</span>
              <span className="font-mono text-sm font-bold text-[#1d3539]">{viewMapLocation[0].toFixed(5)}, {viewMapLocation[1].toFixed(5)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Edit Store Item Modal */}
      {editingItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setEditingItemId(null)}>
          <div className="bg-white p-6 rounded-3xl w-[calc(100%-8px)] sm:w-full max-w-lg border-4 border-[#1d3539] shadow-[8px_8px_0px_0px_#1d3539] relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setEditingItemId(null)} className="absolute top-4 right-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full w-8 h-8 flex items-center justify-center font-bold active:scale-95 transition-all">✕</button>
            <h3 className="text-xl font-black text-[#1d3539] uppercase mb-4">Edit Item</h3>
            <form onSubmit={handleAddStoreItem} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold text-teal-700/70 uppercase">Item Name</label>
                <input required type="text" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" placeholder="e.g. Free Coffee Voucher" />
              </div>
              <div>
                <label className="text-xs font-bold text-teal-700/70 uppercase">Description</label>
                <textarea required value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 resize-none h-20" placeholder="Details..." />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-teal-700/70 uppercase">Price</label>
                  <input required type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value === '' ? '' : Number(e.target.value))} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-teal-700/70 uppercase">Stock</label>
                  <input required type="number" value={newItemStock} onChange={e => setNewItemStock(e.target.value === '' ? '' : Number(e.target.value))} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-teal-700/70 uppercase">Icon (Emoji)</label>
                  <input required type="text" value={newItemIcon} onChange={e => setNewItemIcon(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-center text-lg" />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-bold text-teal-700/70 uppercase">Category</label>
                  <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value)} className="w-full mt-1 border border-slate-300 rounded-lg p-2.5 text-sm outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white">
                    <option value="">None</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2 py-2">
                <input type="checkbox" id="modalProfileShow" checked={newItemProfile} onChange={e => setNewItemProfile(e.target.checked)} className="w-4 h-4 text-teal-600 rounded border-slate-300" />
                <label htmlFor="modalProfileShow" className="text-sm font-bold text-slate-700">Display item in user's profile</label>
              </div>
              <button type="submit" className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 shadow-lg shadow-teal-500/20 border-none text-white font-bold py-3 rounded-xl mt-2 hover:bg-black shadow-sm transition-colors">
                Update Item
              </button>
            </form>
          </div>
        </div>
      )}
      
      <AdminMessagesModal 
        isOpen={isAdminMessagesOpen} 
        onClose={() => setIsAdminMessagesOpen(false)} 
        readMessageIds={readAdminMessageIds}
        onInitReadIds={(ids) => setReadAdminMessageIds(ids)}
        onMessageRead={(id) => {
          setReadAdminMessageIds(prev => {
            if (prev.includes(id)) return prev;
            return [...prev, id];
          });
          apiClient(`/mail/user/${id}/read`, { method: 'POST' }).catch(() => {});
        }}
      />
      <MessageAuthorityModal 
        isOpen={isMessageAuthorityModalOpen} 
        onClose={() => {
          setIsMessageAuthorityModalOpen(false);
          setSelectedAuthorityForMessage(null);
        }} 
        authority={selectedAuthorityForMessage} 
      />
    </div>
  );
};
