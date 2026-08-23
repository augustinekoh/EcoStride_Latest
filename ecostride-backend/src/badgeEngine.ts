import { notificationService } from './notificationService';

export async function checkAndAwardBadges(c: any, userId: string) {
  try {
    const user = await c.env.DB.prepare('SELECT total_distance_km, total_trees_planted, unlocked_badges, guild_id FROM users WHERE id = ?').bind(userId).first();
    if (!user) return;

    const signpostStats = await c.env.DB.prepare('SELECT MAX(likes) as maxLikes FROM signposts WHERE author_id = ?').bind(userId).first();
    const maxLikes = signpostStats && signpostStats.maxLikes ? signpostStats.maxLikes : 0;

    let currentBadges: any[] = [];
    try {
      currentBadges = JSON.parse(user.unlocked_badges || '[]');
    } catch (e) {}

    const trees = user.total_trees_planted || 0;
    const distance = user.total_distance_km || 0;

    // Evaluate levels
    const newLevels = {
      first_seed: trees >= 1 ? 1 : 0,
      nature_lover: trees >= 5 ? 1 : 0,
      forest_guardian: Math.floor(trees / 10),
      eco_legend: Math.floor(trees / 50),
      first_step: distance >= 1 ? 1 : 0,
      runner_10k: Math.floor(distance / 10),
      marathoner: Math.floor(distance / 42),
      community_builder: user.guild_id ? 1 : 0,
      trendsetter: maxLikes >= 1000 ? 3 : maxLikes >= 100 ? 2 : maxLikes >= 10 ? 1 : 0
    };

    const badgeDefs: Record<string, { name: string, icon: string }> = {
      first_seed: { name: 'First Seed', icon: '🌱' },
      nature_lover: { name: 'Nature Lover', icon: '🌿' },
      forest_guardian: { name: 'Forest Guardian', icon: '🌳' },
      eco_legend: { name: 'Eco Legend', icon: '👑' },
      first_step: { name: 'First Step', icon: '👟' },
      runner_10k: { name: '10K Runner', icon: '🏃' },
      marathoner: { name: 'Marathoner', icon: '🏅' },
      community_builder: { name: 'Community Builder', icon: '🤝' },
      trendsetter: { name: 'Trendsetter', icon: '✨' }
    };

    let badgesUpdated = false;
    const newOrUpgradedBadges: any[] = [];

    // Map existing badges by ID
    const existingMap = new Map(currentBadges.map((b: any) => [b.id || b.name, b]));

    for (const [id, calculatedLevel] of Object.entries(newLevels)) {
      if (calculatedLevel > 0) {
        const existing = existingMap.get(id);
        const currentLevel = existing && existing.level ? existing.level : (existing ? 1 : 0);

        if (calculatedLevel > currentLevel) {
          const newBadgeObj = {
            id,
            name: badgeDefs[id].name,
            icon: badgeDefs[id].icon,
            level: calculatedLevel
          };
          existingMap.set(id, newBadgeObj);
          newOrUpgradedBadges.push(newBadgeObj);
          badgesUpdated = true;
        }
      }
    }

    if (badgesUpdated) {
      // Keep any custom badges that aren't in badgeDefs (admin-given)
      const finalBadges = Array.from(existingMap.values());
      
      await c.env.DB.prepare('UPDATE users SET unlocked_badges = ? WHERE id = ?')
        .bind(JSON.stringify(finalBadges), userId).run();

      // Send notifications for each new/upgraded badge
      for (const b of newOrUpgradedBadges) {
        let msg = `You unlocked the '${b.name}' badge!`;
        if (b.level > 1) {
          msg = `You upgraded the '${b.name}' badge to Level ${b.level}!`;
        }
        
        await notificationService.createMailAndNotify(c.env, {
          title: 'Badge Unlocked!',
          content: msg,
          sender: 'EcoStride Achievements',
          recipient_type: 'user',
          recipient_id: userId,
          action_type: 'badge_unlocked',
          notification_type: 'mailbox',
          notification_priority: 'normal'
        });
      }
    }
  } catch (err) {
    console.error("Error in checkAndAwardBadges", err);
  }
}
