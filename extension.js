/* -*- mode: js2; js2-basic-offset: 4; indent-tabs-mode: nil -*- */

const St = imports.gi.St;
const GLib = imports.gi.GLib;
const Main = imports.ui.main;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Itl = imports.gi.Itl;
const GObject = imports.gi.GObject;
const Gst = imports.gi.Gst;
const MessageTray = imports.ui.messageTray;
const PopupMenu = imports.ui.popupMenu;
const Gio = imports.gi.Gio;
const Util = imports.misc.util;

const Gettext = imports.gettext.domain('islamic-datetime');
const _ = Gettext.gettext;

const CONFIG_SCHEMA = 'org.gnome.shell.extensions.islamic-datetime';
function PrayerNotificationSource() {
    this._init();
}

PrayerNotificationSource.prototype = {
    __proto__:  MessageTray.Source.prototype,

    _init: function() {
        MessageTray.Source.prototype._init.call(this, _("Salat"));

        this._setSummaryIcon(this.createNotificationIcon());
    },

    createNotificationIcon: function() {
        return new St.Icon({ icon_name: 'minbar',
                             icon_type: St.IconType.FULLCOLOR,
                             icon_size: this.ICON_SIZE });
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
      let dateMenu = Main.panel._dateMenu;
      let children = dateMenu.menu._getMenuItems();

      let vbox = new St.BoxLayout({vertical: true});
      dateMenu.menu.addActor(vbox);

      let separator = new PopupMenu.PopupSeparatorMenuItem();
      separator.setColumnWidths(1);
      vbox.add(separator.actor, {y_align: St.Align.END, expand: true, y_fill: false});

      this._hdate = new St.Label({style_class: 'datemenu-date-label'});
      vbox.add(this._hdate);

      let hbox1 = new St.BoxLayout();
      vbox.add(hbox1);

      this._PrayerLabel = new Array();
      for(let i=0; i<6; i++) {
        this._PrayerLabel.push(new St.Label());
        hbox1.add(this._PrayerLabel[i]);
      }

      let hbox2 = new St.BoxLayout();
      vbox.add(hbox2);
      this._RemLabel = new St.Label();
      hbox2.add(this._RemLabel);

      let item = new PopupMenu.PopupMenuItem(_("Islamic Date/Time functions settings"));
      item.connect('activate', function() {
          Util.spawn(["islamic-datetime-config"]);
      });
      hbox2.add(item.actor, {x_align: St.Align.END, expand: true, x_fill: false});

      dateMenu._upClient.connect('notify-resume', Lang.bind(this, this._updateDateTime));

      Gst.init(null);
      this._playbin = Gst.ElementFactory.make('playbin2', 'play');
      this._playbin.set_state(Gst.State.NULL);

      this._PrayerObj = new Itl.Prayer();
      this._config();
    },

    _config: function() {
      if(this._settings == null) {
        if (Gio.Settings.list_schemas().indexOf(CONFIG_SCHEMA) == -1)
            throw _("Schema \"%s\" not found.").format(CONFIG_SCHEMA);
        this._settings = new Gio.Settings({ schema: CONFIG_SCHEMA });
        this._settings.connect('changed', Lang.bind(this, this._config));
      }

      this._playbin.uri = 'file://' + this._settings.get_string('azan-file');

      this._PrayerObj.degree_long = this._settings.get_double('longitude');
      this._PrayerObj.degree_lat = this._settings.get_double('latitude');
      this._PrayerObj.gmt_diff = this._settings.get_double('gmt-diff');
      this._PrayerObj.dst = this._settings.get_boolean('dst');

      this._PrayerObj.setMethod(this._settings.get_enum('method'));

      this._updateDateTime();
    },

    _updateDateTime: function() {
      let now = new Date();

      // Get Hijri date:
      let dd = Itl.h_date(now.getDate(), now.getMonth()+1, now.getFullYear());
      this._hdate.set_text(" " + dd.get_day() + " " + HijriMonthName(dd.get_month()) + " " + dd.get_year());

      // Get prayer times:
      let today = new GLib.Date.new_dmy(now.getDate(), now.getMonth()+1, now.getFullYear());
      let PrayerList = this._PrayerObj.getPrayerTimes(today);

      let nowMins = now.getHours() * 60 + now.getMinutes();

      for(let i=0; i<6; i++) {
        this._PrayerLabel[i].set_text("\t" + PrayerName(i) + ": " + PrayerList[i].get_hour() + ":" + PrayerList[i].get_minute());
        this._PrayerLabel[i].style_class = 'gen-prayer-label';
      }
      this._PrayerLabel[1].style_class = 'non-prayer-label';

      // Find upcoming prayer:
      let RemMins;
      let PrayerIdx=0;
      for(let i=0; i<6; i++, PrayerIdx=i) {
        let PrayerMins = PrayerList[i].get_hour() * 60 + PrayerList[i].get_minute();
        RemMins = PrayerMins - nowMins;
        if((nowMins <= PrayerMins) && (i!=1)) {
          break;
        }
      }
      if(PrayerIdx == 6) {
        // Case that now > Isha (which is before midnight):
        PrayerIdx = 0;
        PrayerList[0] = this._PrayerObj.getNextDayFajr(today);
        this._PrayerLabel[0].set_text(" " + PrayerName(0) + ": " + PrayerList[0].get_hour() + ":" + PrayerList[0].get_minute());
        RemMins = 24*60 - nowMins + PrayerList[0].get_hour()*60 + PrayerList[0].get_minute();
      }

      this._PrayerLabel[PrayerIdx].style_class = 'current-prayer-label';

      let RemStr = RemMins + ' minutes';
      if(RemMins >= 60) {
        RemStr = Math.floor(RemMins/60) + ' hrs ' + RemMins%60 + ' minutes';
      }
      this._RemLabel.set_text(' ' + RemStr + ' left for ' + PrayerName(PrayerIdx) + ' prayer');

      // Play azan when now = prayertime
      if(RemMins == 5) {
        this._notify(this._RemLabel.get_text(), true);
      }
      else if(RemMins == 0) {
        this._RemLabel.set_text('Time now for ' + PrayerName(PrayerIdx) +  ' prayer', false);
        this._notify(this._RemLabel.get_text());

        this._playAzan();
      }

      Mainloop.timeout_add_seconds(60, Lang.bind(this, this._updateDateTime));
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
        notification.addButton('stop-azan', _("Stop azan"));
        notification.connect('action-invoked', Lang.bind(this, this._stopAzan));
      }

      this._source.notify(notification);
    },

    _stopAzan: function() {
      this._playbin.set_state(Gst.State.NULL);
    },

    _playAzan: function() {
      this._playbin.set_state(Gst.State.NULL);
      this._playbin.set_state(Gst.State.PLAYING);
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

function init(metadata) {

  new IslamicDateTime();

}
