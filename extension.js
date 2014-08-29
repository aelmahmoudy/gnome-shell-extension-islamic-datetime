/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const St = imports.gi.St;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
let ItlMissing = false;
try {
  const Itl = imports.gi.Itl;
} catch(e) {
  log(e);
  ItlMissing = true;
}
const GObject = imports.gi.GObject;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const Util = imports.misc.util;

const Gettext = imports.gettext.domain('islamic-datetime');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

function PrayerNotificationSource() {
    this._init();
}

PrayerNotificationSource.prototype = {
    __proto__:  MessageTray.Source.prototype,

    _init: function() {
        MessageTray.Source.prototype._init.call(this, _("Salat"), 'islamic-datetime');
    },

    open: function() {
        this.destroy();
    }
};

function IslamicDateTime() {
    this._init.apply(this, arguments);
}

IslamicDateTime.prototype = {
    __proto__: GObject.prototype,

    _init: function(params) {
      let dateMenu = Main.panel.statusArea.dateMenu;
      let children = dateMenu.menu._getMenuItems();

      this._dateButton = new St.Button({style_class: 'button'});
      this._dateButton.connect('clicked',  Lang.bind(this, this._toggleDisplayDate));
      this._hdate = new St.Label({style_class: 'datemenu-date-label'});
      let dateMenuvbox = dateMenu._date.get_parent();
      dateMenuvbox.remove_child(dateMenu._date);
      this._dateButton.set_child(dateMenu._date);
      dateMenu._date.connect('clicked',  Lang.bind(this, this._toggleDisplayDate));
      dateMenuvbox.insert_child_at_index(this._dateButton,0);

      let hbox = new St.BoxLayout();
      dateMenu.menu.box.add(hbox);
      this._hbox = hbox;

      let vbox = new St.BoxLayout({vertical: true});
      hbox.add(vbox);

      let separator = new PopupMenu.PopupSeparatorMenuItem();
      vbox.add(separator.actor, {y_align: St.Align.END, expand: true, y_fill: false});

      let hbox1 = new St.BoxLayout();
      vbox.add(hbox1);

      let hbox2 = new St.BoxLayout();
      vbox.add(hbox2);

      this._PrayerLabel = new Array();
      for(let i=0; i<6; i++) {
        this._PrayerLabel.push(new St.Label());
        if(i==1) {
          hbox2.add(this._PrayerLabel[i]);
        }
        else {
          hbox1.add(this._PrayerLabel[i]);
        }
      }
      this._MidnightLabel = new St.Label();
      hbox2.add(this._MidnightLabel);
      this._LastThrdLabel = new St.Label();
      hbox2.add(this._LastThrdLabel);
      this._PrayerLabel[1].style_class = 'non-prayer-label';
      this._MidnightLabel.style_class = 'non-prayer-label';
      this._LastThrdLabel.style_class = 'non-prayer-label';

      let hbox0 = new St.BoxLayout();
      vbox.add(hbox0);
      this._RemLabel = new St.Label();
      hbox0.add(this._RemLabel);

      let systemMenu = Main.panel.statusArea.aggregateMenu._system;
      let button = systemMenu._createActionButton('preferences-system-symbolic', _("Settings"));

      button.connect('clicked', function() {
        dateMenu.menu.actor.hide();
        Util.spawn(["gnome-shell-extension-prefs", Me.metadata.uuid]);
      });
      hbox.add(button, {x_align: St.Align.END, y_align: St.Align.END, expand: true, x_fill: false, y_fill: false});

      this._timeoutId = 0;

      this._PrayerObj = new Itl.Prayer();

      this._config();
      this._azanFlag = 0;
      this._azanStopped = 0;
      this._azanFile = "";
      this._systemTZ = true;
      this._notify_resumeId = dateMenu._clock.connect('notify::clock', Lang.bind(this, this._updateDateTime));
    },

    _config: function() {
      if(this._settings == null) {
        this._settings = Convenience.getSettings();
        this._settings.connect('changed', Lang.bind(this, this._config));
      }

      this._azanFile = this._settings.get_string('azan-file');

      this._PrayerObj.degree_long = this._settings.get_double('longitude');
      this._PrayerObj.degree_lat = this._settings.get_double('latitude');
      this._systemTZ =  this._settings.get_boolean('system-tz');
      if(!this._systemTZ) {
        this._PrayerObj.gmt_diff = this._settings.get_double('gmt-diff');
        this._PrayerObj.dst = this._settings.get_boolean('dst');
      }

      this._PrayerObj.setMethod(this._settings.get_enum('method'));

      this._HijriFix = this._settings.get_int('hijri-fix');

      let dateMenu = Main.panel.statusArea.dateMenu;
      if(this._settings.get_boolean('display-hijri')) {
        this._dateButton.set_child(this._hdate);
      }
      else {
        this._dateButton.set_child(dateMenu._date);
      }

      this._updateDateTime();
    },

    _toggleDisplayDate: function() {
      this._settings.set_boolean('display-hijri', !(this._settings.get_boolean('display-hijri')));
    },

    _updateDateTime: function() {
      let now = new Date();

      // Get Hijri date:
      let pnow = new Date(now.getTime() + this._HijriFix*24*60*60*1000);
      let dd = Itl.h_date(pnow.getDate(), pnow.getMonth()+1, pnow.getFullYear());
      this._hdate.set_text(now.toLocaleFormat(_("%A")) + " " + HijriMonthName(dd.get_month()) + " " + dd.get_day() + ", " + dd.get_year());

      // Get prayer times:
      let today = new GLib.Date;
      today.set_dmy(now.getDate(), now.getMonth()+1, now.getFullYear());
      if(this._systemTZ) {
        let now2 = GLib.DateTime.new_now_local();
        this._PrayerObj.gmt_diff = now2.get_utc_offset() / (60*60*1000000);
        this._PrayerObj.dst = 0;
      }
      let PrayerList = this._PrayerObj.getPrayerTimes(today);
      let NextDayFajr = this._PrayerObj.getNextDayFajr(today);

      let nowMins = now.getHours() * 60 + now.getMinutes();
      let MaghribMins = AbsMins(PrayerList[4]);
      let NextDayFajrMins = AbsMins(NextDayFajr);
      let midnightMins = (NextDayFajrMins + (24*60 - MaghribMins))/2 + MaghribMins;
      midnightMins = Math.floor(midnightMins);
      if(midnightMins >= 1440) {
        midnightMins -= 1440;
      }
      let lastthrdMins = (NextDayFajrMins + (24*60 - MaghribMins))*2/3 + MaghribMins;
      lastthrdMins = Math.ceil(lastthrdMins);
      if(lastthrdMins >= 1440) {
        lastthrdMins -= 1440;
      }

      for(let i=0; i<6; i++) {
        this._PrayerLabel[i].set_text("     " + PrayerName(i) + ": " + PrayerList[i].get_hour() + ":" + ("%02d").format(PrayerList[i].get_minute()));
        if(i!=1) {
          this._PrayerLabel[i].style_class = 'gen-prayer-label';
        }
      }
      this._MidnightLabel.set_text("     " + _("Midnight") + ": " + Math.floor(midnightMins/60) + ":" + ("%02d").format(midnightMins%60));
      this._LastThrdLabel.set_text("     " + _("Last third of night") + ": " + Math.floor(lastthrdMins/60) + ":" + ("%02d").format(lastthrdMins%60));

      // Find upcoming prayer:
      let RemMins;
      let PrayerIdx=0;
      for(let i=0; i<6; i++, PrayerIdx=i) {
        let PrayerMins = AbsMins(PrayerList[i]);
        RemMins = PrayerMins - nowMins;
        if((nowMins <= PrayerMins) && (i!=1)) {
          break;
        }
      }
      if(PrayerIdx == 6) {
        // Case that now > Isha (which is before midnight):
        PrayerIdx = 0;
        PrayerList[0] = NextDayFajr;
        this._PrayerLabel[0].set_text(" " + PrayerName(0) + ": " + PrayerList[0].get_hour() + ":" + PrayerList[0].get_minute());
        RemMins = 24*60 - nowMins + NextDayFajrMins;
      }

      for(let i=0; i<PrayerIdx; i++) {
        if(i==1) continue;
        this._PrayerLabel[i].style_class = 'past-prayer-label';
      }
      this._PrayerLabel[PrayerIdx].style_class = 'current-prayer-label';

      let RemStr = _("    %d minutes").format(RemMins);
      if(RemMins >= 60) {
        RemStr = _("    %d hours %d minutes").format(Math.floor(RemMins/60), RemMins%60);
      }
      this._RemLabel.set_text( _(" %s left for %s prayer").format(RemStr, PrayerName(PrayerIdx)) );

      // Play azan when now = prayertime
      if(RemMins == 5) {
        this._notify(this._RemLabel.get_text(), true);
      }
      else if((RemMins == 0) && !this._azanFlag && !this._azanStopped) {
        this._RemLabel.set_text( _("    %d:%02d Time now for %s prayer").format(PrayerList[PrayerIdx].get_hour(),
                                                                                PrayerList[PrayerIdx].get_minute(),
                                                                                PrayerName(PrayerIdx)), false );
        this._notify(this._RemLabel.get_text());

        this._playAzan();
      }

      this._timeoutId = Mainloop.timeout_add_seconds(60, Lang.bind(this, this._updateDateTime));
      return false;
    },

    _notify: function(text, isTransient) {
      if(this._source == null) {
        this._source = new PrayerNotificationSource();
        this._source.connect('destroy', Lang.bind(this,
          function() {
              this._source = null;
          }));
        Main.messageTray.add(this._source);
      }

      let notification = null;
      if(this._source.notifications.length == 0) {
        notification = new MessageTray.Notification(this._source, text, null);
      } else {
        notification = this._source.notifications[0];
        notification.update(text, null, { clear: true });
      }

      notification.setTransient(isTransient);
      if(!isTransient) {
        notification.addAction(_("Stop azan"), this._stopAzan);
      }

      this._source.notify(notification);
    },

    _stopAzan: function() {
      this._azanFlag = 0;
      this._azanStopped = 1;
      Mainloop.timeout_add_seconds(60, Lang.bind(this,
        function() {
            this._azanStopped = 0;
        }));
      global.cancel_theme_sound(1);
    },

    _playAzan: function() {
      this._azanFlag = 1;
      global.play_sound_file(1, this._azanFile, "azan", null);
    },

    _destroy: function() {
      let dateMenu = Main.panel.statusArea.dateMenu;
      dateMenu._clock.disconnect(this._notify_resumeId);
      if(this._timeoutId > 0) {
        Mainloop.source_remove(this._timeoutId);
        this._timeoutId = 0;
      }
      this._dateButton.set_child(this._hdate);
      let dateMenuvbox = this._dateButton.get_parent();
      dateMenuvbox.insert_child_at_index(dateMenu._date, 0);
      this._dateButton.destroy();
      this._hbox.destroy();
    }
};

function HijriMonthName(HijriMonth)
{
  switch(HijriMonth) {
    case 1: return _("Muharram");
    case 2: return _("Safar");
    case 3: return _("Rabi' I");
    case 4: return _("Rabi' II");
    case 5: return _("Jumaada I");
    case 6: return _("Jumaada II");
    case 7: return _("Rajab");
    case 8: return _("Shaa'ban");
    case 9: return _("Ramadan");
    case 10: return _("Shawwaal");
    case 11: return _("Thul Qi'dah");
    case 12: return _("Thul Hijjah");
  }
  return undefined;
}

function PrayerName(PrayerIdx)
{
  switch(PrayerIdx) {
    case 0: return _("Fajr");
    case 1: return _("Shurooq");
    case 2: return _("Dhuhr");
    case 3: return _("'Asr");
    case 4: return _("Maghrib");
    case 5: return _("'Ishaa");
  }
  return undefined;
}

function AbsMins(ptime)
{
  return(ptime.get_hour() * 60 + ptime.get_minute());
}

let IslamicDateTimeMenu;

function init(metadata) {
  Convenience.initTranslations();
}

function enable() {
  if(ItlMissing) {
    let _source = new PrayerNotificationSource();
    _source.connect('destroy', Lang.bind(_source,
      function() {
          _source = null;
      }));
    Main.messageTray.add(_source);

    let notification = null;
    const MESSAGE = "Dependencies Missing\n\
Please make sure that GObject introspection data for libitl library is installed\n\
\t    on Debian/Ubuntu: gir1.2-itl-1.0"
    notification = new MessageTray.Notification(_source, MESSAGE, null);

    _source.notify(notification);
    return false;
  }
  IslamicDateTimeMenu = new IslamicDateTime();
  return true;
}

function disable() {
  IslamicDateTimeMenu._destroy();
}
