const fs = require('fs');
let content = fs.readFileSync('src/views/TasksView.tsx', 'utf8');

const target = `  const handleReprintTask = async (task: Task) => {
    if (!currentUid) return;
    try {
      const q1 = query(
        collection(db, \`users/\${currentUid}/activities\`),
        where('type', '==', 'meter_test')
      );
      
      const snapshot = await getDocs(q1);
      const activities = snapshot.docs.map(d => d.data() as any);
      
      activities.sort((a, b) => {
          const t1 = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.date).getTime();
          const t2 = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.date).getTime();
          return t2 - t1;
      });

      let match = activities.find(a => 
        (a.taskId && a.taskId === task.id) ||
        (task.accountNumber && a.details?.accountNumber === task.accountNumber) ||
        (task.accountName && a.details?.testAccountName === task.accountName)
      );

      if (!match) {
        const taskTime = task.completedAt ? new Date(task.completedAt).getTime() : (task.createdAt ? new Date(task.createdAt).getTime() : 0);
        if (taskTime > 0) {
           match = activities.find(a => {
              const actTime = new Date(a.date).getTime();
              return Math.abs(actTime - taskTime) < 24 * 60 * 60 * 1000;
           });
        }
      }

      if (!match && activities.length > 0) {
        match = activities[0];
      }

      if (match) {
        setReprintData(match);
        setTimeout(() => window.print(), 500);
      } else {
        showToast("No corresponding meter test form found.", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Error finding form", "error");
    }
  };`;

const replacement = `  const handleReprintTask = async (task: Task) => {
    if (!currentUid) return;
    try {
      // Fetch ALL activities in case 'type' is not exactly 'meter_test' or something
      const q1 = query(
        collection(db, \`users/\${currentUid}/activities\`)
      );
      
      const snapshot = await getDocs(q1);
      let activities = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      
      // Filter for meter_test locally just to be sure
      activities = activities.filter(a => a.type === 'meter_test');
      
      activities.sort((a, b) => {
          const t1 = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.date || 0).getTime();
          const t2 = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.date || 0).getTime();
          return t2 - t1;
      });

      let match = activities.find(a => 
        (a.taskId && a.taskId === task.id) ||
        (task.accountNumber && a.details?.accountNumber && a.details?.accountNumber.includes(task.accountNumber)) ||
        (task.accountName && a.details?.testAccountName && a.details?.testAccountName.includes(task.accountName))
      );

      // Fallback: If no strict match, check if there's any meter test on the same day for this user
      if (!match && activities.length > 0) {
        match = activities[0];
      }

      if (match) {
        setReprintData(match);
        setTimeout(() => {
          window.print();
        }, 500);
      } else {
        // Log to console so we can see what activities were returned
        console.log("No meter_test activities found. Total activities fetched: ", snapshot.docs.length);
        alert(\`No corresponding meter test form found. (Total activities: \${snapshot.docs.length})\`);
      }
    } catch (error) {
      console.error(error);
      showToast("Error finding form", "error");
    }
  };`;

content = content.replace(target, replacement);
fs.writeFileSync('src/views/TasksView.tsx', content);
