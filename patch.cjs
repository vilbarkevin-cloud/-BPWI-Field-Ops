const fs = require('fs');
let content = fs.readFileSync('src/views/TasksView.tsx', 'utf8');

const target = `  const handleReprintTask = async (task: Task) => {
    if (!currentUid) return;
    try {
      // Fetch ALL activities in case 'type' is not exactly 'meter_test' or something
      const q1 = query(
        collection(db, \\\`users/\\\${currentUid}/activities\\\`)
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

      // If still not found, check local offline queue (watsanActivities)
      if (!match) {
        try {
          const localActs = await get("watsanActivities") || [];
          const localMeterTests = localActs.filter((a: any) => a.type === 'meter_test');
          match = localMeterTests.find((a: any) => 
            (a.taskId && a.taskId === task.id) ||
            (task.accountNumber && a.details?.accountNumber && a.details?.accountNumber.includes(task.accountNumber)) ||
            (task.accountName && a.details?.testAccountName && a.details?.testAccountName.includes(task.accountName))
          );
        } catch (e) {
          console.warn("Failed reading from local IDB", e);
        }
      }

      // If still no match (e.g. no activity was ever created, just a task), generate a fallback so they can print a blank form for field use
      if (!match) {
        match = {
          date: task.createdAt || new Date().toISOString(),
          siteOrWell: task.location || task.facility || task.site || "",
          area: task.facility || "",
          blockLot: task.blockLot || "",
          details: {
            testAccountName: task.accountName || "",
            accountNumber: task.accountNumber || "",
          },
          staff: task.assignedTo ? [task.assignedTo] : []
        };
      }

      if (match) {
        setReprintData(match);
        setTimeout(() => {
          window.print();
        }, 500);
      } else {
        // Log to console so we can see what activities were returned
        console.log("No meter_test activities found. Total activities fetched: ", snapshot.docs.length);
        alert(\\\`No corresponding meter test form found. (Total activities: \\\${snapshot.docs.length})\\\`);
      }
    } catch (error) {
      console.error(error);
      showToast("Error finding form", "error");
    }
  };`;

const replacement = `  const handlePrintTask = async (task: Task) => {
    if (!currentUid) return;
    
    let match: any = null;
    
    try {
      // Fetch ALL activities in case 'type' is not exactly 'meter_test' or something
      const q1 = query(
        collection(db, \\\`users/\\\${currentUid}/activities\\\`)
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

      match = activities.find(a => 
        (a.taskId && a.taskId === task.id) ||
        (task.accountNumber && a.details?.accountNumber && a.details?.accountNumber.includes(task.accountNumber)) ||
        (task.accountName && a.details?.testAccountName && a.details?.testAccountName.includes(task.accountName))
      );

      // Fallback: If no strict match, check if there's any meter test on the same day for this user
      if (!match && activities.length > 0) {
        match = activities[0];
      }
    } catch (error) {
      console.warn("Failed fetching activities from firestore. Continuing to offline check.", error);
    }

    // If still not found, check local offline queue (watsanActivities)
    if (!match) {
      try {
        const localActs = await get("watsanActivities") || [];
        const localMeterTests = localActs.filter((a: any) => a.type === 'meter_test');
        match = localMeterTests.find((a: any) => 
          (a.taskId && a.taskId === task.id) ||
          (task.accountNumber && a.details?.accountNumber && a.details?.accountNumber.includes(task.accountNumber)) ||
          (task.accountName && a.details?.testAccountName && a.details?.testAccountName.includes(task.accountName))
        );
      } catch (e) {
        console.warn("Failed reading from local IDB", e);
      }
    }

    // If still no match (e.g. no activity was ever created, or network failed), generate a fallback so they can print a blank form for field use
    if (!match) {
      match = {
        date: task.createdAt || new Date().toISOString(),
        siteOrWell: task.location || task.facility || task.site || "",
        area: task.facility || "",
        blockLot: task.blockLot || "",
        details: {
          testAccountName: task.accountName || "",
          accountNumber: task.accountNumber || "",
        },
        staff: task.assignedTo ? [task.assignedTo] : []
      };
    }

    if (match) {
      setReprintData(match);
      setTimeout(() => {
        window.print();
      }, 500);
    }
  };`;

content = content.replace(target.replace(/\\`/g, '\`'), replacement.replace(/\\`/g, '\`'));
fs.writeFileSync('src/views/TasksView.tsx', content);
