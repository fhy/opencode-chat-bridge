#!/bin/bash
# OpenCode Chat Bridge - Service Management Script

case "$1" in
  start)
    sudo systemctl start opencode-bridge-reviewer opencode-bridge-worker opencode-bridge-planner
    echo "All services started"
    ;;
  stop)
    sudo systemctl stop opencode-bridge-reviewer opencode-bridge-worker opencode-bridge-planner
    echo "All services stopped"
    ;;
  restart)
    sudo systemctl restart opencode-bridge-reviewer opencode-bridge-worker opencode-bridge-planner
    echo "All services restarted"
    ;;
  status)
    sudo systemctl status opencode-bridge-reviewer opencode-bridge-worker opencode-bridge-planner
    ;;
  logs)
    case "$2" in
      reviewer|worker|planner)
        sudo journalctl -u "opencode-bridge-$2" -f --no-pager
        ;;
      *)
        sudo journalctl -u "opencode-bridge-reviewer" -u "opencode-bridge-worker" -u "opencode-bridge-planner" -f --no-pager
        ;;
    esac
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs [reviewer|worker|planner]}"
    exit 1
    ;;
esac
