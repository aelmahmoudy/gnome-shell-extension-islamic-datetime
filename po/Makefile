POTFILE=$(shell cat POTFILES.in)
SOURCES=$(addprefix ../, $(POTFILE))
POFILES=$(wildcard *.po)
all: $(POFILES)

islamic-datetime.pot: $(SOURCES)
	intltool-update -g islamic-datetime -p

%.po: islamic-datetime.pot
	intltool-update -g islamic-datetime -d $*

