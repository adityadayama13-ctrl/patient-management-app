====================================================
  Clinic Patient Management App
====================================================

GETTING STARTED (fresh Windows PC)
----------------------------------------------------
1. Extract this ZIP to a folder, e.g.:
     C:\ClinicApp\

2. Double-click  setup.bat
   - Click YES on the UAC (Administrator) prompt
   - Setup will automatically install:
       * Node.js  (if not already installed)
       * PostgreSQL 16  (if not already installed)
   - Then it creates the database and configures
     the app. This takes 5–10 minutes on first run
     (downloads ~330 MB).

3. Double-click  start.bat  to launch the app.

4. Open a browser on this PC:
     http://localhost:5000


DEFAULT DATABASE PASSWORD
----------------------------------------------------
The default PostgreSQL password is:  Clinic@2024

To change it:
  1. Open .env in Notepad
  2. Change DB_PASSWORD to your new password
  3. Also change the password in PostgreSQL using
     pgAdmin (installed with PostgreSQL)
  4. Restart the app with start.bat


SHARING ON THE CLINIC NETWORK
----------------------------------------------------
1. Connect the PC and all clinic devices to the
   same WiFi router.
2. Start the app with start.bat
3. It shows two addresses:
     This PC:   http://localhost:5000
     Network:   http://192.168.x.x:5000  ← share this
4. Open the Network address on any phone,
   tablet, or laptop on the same WiFi.

NOTE: Keep this PC on and start.bat running for
other devices to access the app.


DAILY USE
----------------------------------------------------
- Double-click  start.bat  every morning
- Close or Ctrl+C to stop at end of day
- Data is saved in the PostgreSQL database
  (persists between sessions)


TROUBLESHOOTING
----------------------------------------------------
"App not set up yet"
  → Run setup.bat first.

"Cannot connect to database"
  → PostgreSQL may not be running.
  → Open Services (Win+R → services.msc), find
    "postgresql-16" and click Start.
  → Check password in .env matches PostgreSQL.

"Address not accessible on other devices"
  → Allow port 5000 through Windows Firewall:
    Win+R → wf.msc → Inbound Rules → New Rule
    → Port → TCP 5000 → Allow

"Setup failed during PostgreSQL install"
  → Run setup.bat again — it will skip steps
    already completed.

====================================================
