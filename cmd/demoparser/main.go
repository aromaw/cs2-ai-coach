package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/golang/geo/r3"
	dem "github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/common"
	"github.com/markus-wa/demoinfocs-golang/v4/pkg/demoinfocs/events"
)

type output struct {
	Parser parserInfo `json:"parser"`
	Upload uploadInfo `json:"upload,omitempty"`
	Match  matchInfo  `json:"match"`
}

type parserInfo struct {
	Name string `json:"name"`
	Mode string `json:"mode"`
}

type uploadInfo struct {
	ID           string `json:"id,omitempty"`
	OriginalName string `json:"originalName,omitempty"`
	Size         int64  `json:"size,omitempty"`
	SHA256       string `json:"sha256,omitempty"`
}

type matchInfo struct {
	ID           string            `json:"id"`
	Map          string            `json:"map"`
	SupportedMap bool              `json:"supportedMap"`
	Score        scoreInfo         `json:"score"`
	Teams        []teamInfo        `json:"teams"`
	RoundsPlayed int               `json:"roundsPlayed"`
	DurationMins int               `json:"durationMinutes"`
	SideWinRates map[string]string `json:"sideWinRates"`
	Players      []playerInfo      `json:"players"`
	Rounds       []roundInfo       `json:"rounds"`
	Evidence     []evidenceInfo    `json:"evidence"`
	GeneratedAt  string            `json:"generatedAt"`
}

type scoreInfo struct {
	TeamA int `json:"team_a"`
	TeamB int `json:"team_b"`
}

type teamInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type playerInfo struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	TeamID      string         `json:"teamId"`
	SteamID     string         `json:"steamId"`
	Profile     string         `json:"profile"`
	SideStart   string         `json:"sideStart"`
	PathSummary []string       `json:"pathSummary"`
	Stats       map[string]any `json:"stats"`
}

type roundInfo struct {
	Number       int               `json:"number"`
	WinnerTeamID string            `json:"winnerTeamId"`
	WinningSide  string            `json:"winningSide"`
	SideByTeam   map[string]string `json:"sideByTeam"`
	ScoreBefore  scoreInfo         `json:"scoreBefore"`
	EconomyType  string            `json:"economyType"`
	Economy      map[string]int    `json:"economy"`
	Result       string            `json:"result"`
	EndReason    string            `json:"endReason"`
	Tags         []string          `json:"tags"`
	Events       []eventInfo       `json:"events"`
}

type eventInfo struct {
	ID               string   `json:"id"`
	Round            int      `json:"round"`
	Time             string   `json:"time"`
	Type             string   `json:"type"`
	PlayerID         string   `json:"playerId"`
	PlayerName       string   `json:"playerName"`
	TeamID           string   `json:"teamId"`
	Side             string   `json:"side"`
	Location         string   `json:"location"`
	Description      string   `json:"description"`
	RelatedPlayerIDs []string `json:"relatedPlayerIds"`
	Impact           string   `json:"impact"`
}

type evidenceInfo struct {
	ID          string  `json:"id"`
	PlayerID    string  `json:"playerId"`
	PlayerName  string  `json:"playerName"`
	TeamID      string  `json:"teamId"`
	Round       int     `json:"round"`
	Time        string  `json:"time"`
	Location    string  `json:"location"`
	Issue       string  `json:"issue"`
	Label       string  `json:"label"`
	Event       string  `json:"event"`
	Description string  `json:"description"`
	Side        string  `json:"side"`
	Severity    float64 `json:"severitySeed"`
}

type playerStats struct {
	name                    string
	steamID                 string
	teamID                  string
	sideStart               string
	kills                   int
	deaths                  int
	assists                 int
	damage                  int
	openingAttempts         int
	openingWins             int
	firstDeaths             int
	tradeKills              int
	tradedDeaths            int
	tradeTimeSum            float64
	kastRounds              int
	roundsPlayed            int
	flashAssists            int
	utilityDamage           int
	enemiesFlashed          int
	teammatesFlashed        int
	utilityImpactRounds     int
	clutchAttempts          int
	clutchWins              int
	postPlantRounds         int
	postPlantSurvivalRounds int
	locationCounts          map[string]int
	deathLocationCounts     map[string]int
}

// killRecord remembers a kill so later kills can be classified as trades
// (a teammate of the victim avenging the death within a short window).
type killRecord struct {
	killerSteam  uint64
	victimSteam  uint64
	victimTeamID string
	time         time.Duration
}

type deathRecord struct {
	steam          uint64
	playerID       string
	name           string
	teamID         string
	location       string
	side           string
	clock          string
	dist           float64
	hasDist        bool
	opening        bool
	teammatesAlive int
	at             time.Duration
	hadAdvantage   bool
}

type parserState struct {
	parser                   dem.Parser
	header                   common.DemoHeader
	currentRound             int
	score                    scoreInfo
	rounds                   []roundInfo
	roundIndex               map[int]int
	events                   []eventInfo
	evidence                 []evidenceInfo
	stats                    map[uint64]*playerStats
	teams                    map[string]string
	roundKills               map[int]int
	recentKills              []killRecord
	roundKill                map[uint64]bool
	roundAssist              map[uint64]bool
	roundDied                map[uint64]bool
	roundTraded              map[uint64]bool
	roundUtilityImpact       map[uint64]bool
	roundParticipants        map[uint64]bool
	roundActive              bool
	roundStartTime           time.Duration
	teamsFrozen              bool
	plantedAt                time.Duration
	aliveT                   int
	aliveCT                  int
	hadBigLead               bool
	leadSide                 string
	roundDeaths              []deathRecord
	deathPlaces              map[uint64]map[string]int
	matchStartTime           time.Duration
	matchEndTime             time.Duration
	lastPositionSample       time.Duration
	roundClutchCandidates    map[uint64]string
	roundPostPlantTeam       string
	roundPostPlantPlayers    map[uint64]bool
	roundPostPlantDied       map[uint64]bool
	roundPostPlantDeaths     []deathRecord
	roundPostPlantAdvantage  bool
	roundStatsSnapshot       map[uint64]*playerStats
	roundDeathPlacesSnapshot map[uint64]map[string]int
	roundEvidenceStart       int
	roundEventsStart         int
}

const (
	tradeWindow      = 5 * time.Second
	tradeDistanceMax = 800.0
)

func main() {
	log.SetOutput(os.Stderr)
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: demoparser <demo.dem>")
		os.Exit(2)
	}

	result, err := parse(os.Args[1])
	if err != nil {
		log.Fatal(err)
	}

	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(result); err != nil {
		log.Fatal(err)
	}
}

func parse(path string) (output, error) {
	f, err := os.Open(path)
	if err != nil {
		return output{}, err
	}
	defer f.Close()

	p := dem.NewParser(f)
	defer p.Close()

	header, err := p.ParseHeader()
	if err != nil {
		return output{}, err
	}

	state := &parserState{
		parser:                p,
		header:                header,
		currentRound:          0,
		roundIndex:            map[int]int{},
		stats:                 map[uint64]*playerStats{},
		teams:                 map[string]string{"team_a": "Team A", "team_b": "Team B"},
		roundKills:            map[int]int{},
		roundKill:             map[uint64]bool{},
		roundAssist:           map[uint64]bool{},
		roundDied:             map[uint64]bool{},
		roundTraded:           map[uint64]bool{},
		roundUtilityImpact:    map[uint64]bool{},
		roundParticipants:     map[uint64]bool{},
		deathPlaces:           map[uint64]map[string]int{},
		roundClutchCandidates: map[uint64]string{},
		roundPostPlantPlayers: map[uint64]bool{},
		roundPostPlantDied:    map[uint64]bool{},
		roundPostPlantDeaths:  []deathRecord{},
	}
	registerHandlers(state)

	if err := p.ParseToEnd(); err != nil {
		return output{}, err
	}
	hadOpenRound := state.roundActive
	if hadOpenRound {
		state.discardOpenRound()
	}
	state.header = p.Header()
	state.capturePlayers()
	if !hadOpenRound {
		state.captureFinalStats()
	}
	state.finalizeRounds()

	players := state.players()
	score := scoreFromRounds(state.rounds)

	return output{
		Parser: parserInfo{Name: "demoinfocs-golang-v4", Mode: "real-demo-parser"},
		Upload: uploadInfo{
			ID:           os.Getenv("CS2_DEMO_UPLOAD_ID"),
			OriginalName: os.Getenv("CS2_DEMO_ORIGINAL_NAME"),
			Size:         envInt64("CS2_DEMO_SIZE"),
			SHA256:       os.Getenv("CS2_DEMO_SHA256"),
		},
		Match: matchInfo{
			ID:           matchID(path, os.Getenv("CS2_DEMO_SHA256")),
			Map:          normalizeMap(state.header.MapName),
			SupportedMap: isSupportedMap(state.header.MapName),
			Score:        score,
			Teams: []teamInfo{
				{ID: "team_a", Name: state.teams["team_a"]},
				{ID: "team_b", Name: state.teams["team_b"]},
			},
			RoundsPlayed: len(state.rounds),
			DurationMins: state.durationMinutes(state.header.PlaybackTime),
			SideWinRates: sideWinRates(state.rounds),
			Players:      players,
			Rounds:       state.rounds,
			Evidence:     state.evidence,
			GeneratedAt:  time.Now().UTC().Format(time.RFC3339),
		},
	}, nil
}

func registerHandlers(s *parserState) {
	s.parser.RegisterEventHandler(func(e events.MatchStart) {
		if !s.isWarmup() && s.matchStartTime == 0 {
			s.matchStartTime = s.parser.CurrentTime()
		}
	})

	s.parser.RegisterEventHandler(func(e events.MatchStartedChanged) {
		if !e.NewIsStarted {
			return
		}
		if s.parser.GameState().TotalRoundsPlayed() == 0 && len(s.rounds) > 0 {
			s.resetMatchData()
		}
		s.matchStartTime = s.parser.CurrentTime()
	})

	s.parser.RegisterEventHandler(func(e events.RoundStart) {
		gs := s.parser.GameState()
		if s.isWarmup() || !gs.IsMatchStarted() {
			return
		}
		number := gs.TotalRoundsPlayed() + 1
		if number < 1 {
			return
		}
		if s.roundActive && s.currentRound == number {
			return
		}
		if s.roundActive {
			s.discardOpenRound()
		}
		s.currentRound = number
		s.resetRoundTracking()
		s.beginRoundSnapshot()
		s.roundActive = true
		s.roundStartTime = s.parser.CurrentTime()
		if s.matchStartTime == 0 {
			s.matchStartTime = s.roundStartTime
		}
		s.capturePlayers()
		s.snapshotRoundParticipants()
		s.snapshotAliveCounts()
		round := roundInfo{
			Number:       number,
			WinnerTeamID: "",
			WinningSide:  "",
			SideByTeam:   s.currentSideByTeam(),
			ScoreBefore:  s.score,
			EconomyType:  currentEconomyType(s.parser.GameState()),
			Economy:      s.currentEconomySnapshot(),
			Result:       "in progress",
			EndReason:    "",
			Tags:         []string{},
			Events:       []eventInfo{},
		}
		if idx, exists := s.roundIndex[number]; exists {
			s.rounds[idx] = round
		} else {
			s.roundIndex[number] = len(s.rounds)
			s.rounds = append(s.rounds, round)
		}
	})

	s.parser.RegisterEventHandler(func(e events.RoundFreezetimeEnd) {
		if s.isWarmup() || !s.roundActive {
			return
		}
		s.roundStartTime = s.parser.CurrentTime()
		s.capturePlayers()
		s.snapshotRoundParticipants()
		if idx, ok := s.roundIndex[s.currentRound]; ok {
			s.rounds[idx].SideByTeam = s.currentSideByTeam()
			s.rounds[idx].EconomyType = currentEconomyType(s.parser.GameState())
			s.rounds[idx].Economy = s.currentEconomySnapshot()
			s.tagEconomyMismatch(idx)
		}
		s.snapshotAliveCounts()
	})

	s.parser.RegisterEventHandler(func(e events.RoundEnd) {
		if s.isWarmup() || !s.roundActive {
			return
		}
		if e.Reason == events.RoundEndReasonGameStart {
			s.discardOpenRound()
			return
		}
		if e.Reason == events.RoundEndReasonStillInProgress {
			return
		}
		number := s.currentRound
		idx, ok := s.roundIndex[number]
		if !ok {
			s.roundActive = false
			return
		}
		round := &s.rounds[idx]
		winnerSide := sideName(e.Winner)
		winnerID := teamIDFromWinner(e.Winner, round.SideByTeam)
		if winnerID == "" {
			s.roundActive = false
			return
		}
		if winnerID == "team_a" {
			s.score.TeamA++
		} else {
			s.score.TeamB++
		}
		round.WinnerTeamID = winnerID
		round.WinningSide = winnerSide
		round.Result = fmt.Sprintf("%s win", winnerID)
		round.EndReason = roundEndReason(e.Reason)
		if s.hadBigLead && s.leadSide != "" && s.leadSide != winnerSide {
			round.Tags = appendUnique(round.Tags, "advantage_throw")
		}
		s.flushDeathEvidence(number)
		s.flushPostPlantEvidence(number, winnerSide)
		if hasTag(round.Tags, "opening_death_swing") || hasTag(round.Tags, "advantage_throw") || hasTag(round.Tags, "post_plant_failure") {
			round.Tags = appendUnique(round.Tags, "key_round")
		}
		s.finalizeAdvancedRoundStats(winnerID)
		s.recordKAST()
		s.captureFinalStats()
		s.matchEndTime = s.parser.CurrentTime()
		s.roundActive = false
		s.clearRoundSnapshot()
	})

	s.parser.RegisterEventHandler(func(e events.Kill) {
		if s.isWarmup() || !s.roundActive || e.Victim == nil {
			return
		}
		number := s.currentRound
		validDuel := isEnemyKill(e)
		if validDuel {
			s.roundKills[number]++
		}
		killerID, killerName, killerTeam := s.playerIdentity(e.Killer)
		victimID, victimName, victimTeam := s.playerIdentity(e.Victim)
		location := playerLocation(e.Victim)
		if location == "unknown" {
			location = playerLocation(e.Killer)
		}
		description := fmt.Sprintf("%s killed %s at %s", fallbackName(killerName, "Unknown"), fallbackName(victimName, "Unknown"), location)
		if !validDuel {
			description = fmt.Sprintf("%s died at %s", fallbackName(victimName, "Unknown"), location)
		}
		event := eventInfo{
			ID:               fmt.Sprintf("r%d_kill_%d", number, len(s.events)+1),
			Round:            number,
			Time:             s.roundClock(),
			Type:             "kill",
			PlayerID:         killerID,
			PlayerName:       killerName,
			TeamID:           killerTeam,
			Side:             sideFromPlayer(e.Killer),
			Location:         location,
			Description:      description,
			RelatedPlayerIDs: []string{victimID},
			Impact:           "kill",
		}
		s.addEvent(number, event)
		s.updateKillStats(e, validDuel && s.roundKills[number] == 1)
		if validDuel {
			s.recordTrade(e)
		}
		aliveTBefore, aliveCTBefore := s.aliveT, s.aliveCT
		s.updateAliveCounts(e)
		s.trackPostPlantDeath(e)
		s.trackClutchCandidate()
		s.maybeTrackAdvantage()
		if !validDuel {
			return
		}
		dist, hasDist := s.nearestTeammateDistance(e.Victim)
		teammatesAlive := s.aliveT
		if e.Victim.Team == common.TeamCounterTerrorists {
			teammatesAlive = s.aliveCT
		}
		s.roundDeaths = append(s.roundDeaths, deathRecord{
			steam:          e.Victim.SteamID64,
			playerID:       victimID,
			name:           victimName,
			teamID:         victimTeam,
			location:       location,
			side:           sideFromPlayer(e.Victim),
			clock:          event.Time,
			dist:           dist,
			hasDist:        hasDist,
			opening:        s.roundKills[number] == 1,
			teammatesAlive: teammatesAlive,
			at:             s.parser.CurrentTime(),
			hadAdvantage:   (e.Victim.Team == common.TeamTerrorists && aliveTBefore > aliveCTBefore) || (e.Victim.Team == common.TeamCounterTerrorists && aliveCTBefore > aliveTBefore),
		})
		s.maybeRepeatPeekEvidence(e, number, event.Time, location, victimID, victimName, victimTeam)
	})

	s.parser.RegisterEventHandler(func(e events.PlayerHurt) {
		if s.isWarmup() || !s.roundActive {
			return
		}
		if e.Attacker == nil || e.Player == nil || e.Attacker == e.Player || e.Attacker.Team == e.Player.Team {
			return
		}
		st := s.ensureStats(e.Attacker)
		damage := e.HealthDamageTaken
		if damage <= 0 && e.HealthDamage > 0 {
			damage = e.HealthDamage
		}
		st.damage += damage
		if isUtilityWeapon(e.Weapon, e.WeaponString) {
			st.utilityDamage += damage
			if damage > 0 {
				s.roundUtilityImpact[e.Attacker.SteamID64] = true
			}
		}
	})

	s.parser.RegisterEventHandler(func(e events.SmokeStart) {
		s.addGrenadeEvent("smoke", "smoke started", e.GrenadeEvent)
	})
	s.parser.RegisterEventHandler(func(e events.FlashExplode) {
		s.addGrenadeEvent("flash", "flash exploded", e.GrenadeEvent)
	})
	s.parser.RegisterEventHandler(func(e events.HeExplode) {
		s.addGrenadeEvent("he", "HE exploded", e.GrenadeEvent)
	})
	s.parser.RegisterEventHandler(func(e events.FireGrenadeStart) {
		s.addGrenadeEvent("fire", "fire started", e.GrenadeEvent)
	})
	s.parser.RegisterEventHandler(func(e events.PlayerFlashed) {
		s.addFlashResult(e)
	})

	s.parser.RegisterEventHandler(func(e events.BombPlanted) {
		s.addBombEvent("c4", "bomb planted", e.Player, bombsiteName(e.Site))
	})
	s.parser.RegisterEventHandler(func(e events.BombDefused) {
		s.addBombEvent("c4", "bomb defused", e.Player, bombsiteName(e.Site))
	})
	s.parser.RegisterEventHandler(func(e events.BombExplode) {
		s.addBombEvent("c4", "bomb exploded", e.Player, bombsiteName(e.Site))
	})

	s.parser.RegisterEventHandler(func(e events.FrameDone) {
		if s.isWarmup() || !s.roundActive {
			return
		}
		now := s.parser.CurrentTime()
		if s.lastPositionSample > 0 && now-s.lastPositionSample < 2*time.Second {
			return
		}
		s.lastPositionSample = now
		for _, p := range s.parser.GameState().Participants().Playing() {
			if !isTrackedPlayer(p) {
				continue
			}
			location := playerLocation(p)
			if location == "unknown" {
				continue
			}
			st := s.ensureStats(p)
			st.locationCounts[location]++
		}
	})
}

func (s *parserState) isWarmup() bool {
	return s.parser.GameState().IsWarmupPeriod()
}

func (s *parserState) roundClock() string {
	elapsed := s.parser.CurrentTime() - s.roundStartTime
	if elapsed < 0 {
		elapsed = 0
	}
	return roundTime(elapsed)
}

func (s *parserState) addEvent(roundNumber int, event eventInfo) {
	s.events = append(s.events, event)
	idx, ok := s.roundIndex[roundNumber]
	if !ok {
		return
	}
	s.rounds[idx].Events = append(s.rounds[idx].Events, event)
}

func (s *parserState) addEvidence(e evidenceInfo) {
	s.evidence = append(s.evidence, e)
	idx, ok := s.roundIndex[e.Round]
	if !ok {
		return
	}
	s.rounds[idx].Events = append(s.rounds[idx].Events, eventInfo{
		ID:               e.ID,
		Round:            e.Round,
		Time:             e.Time,
		Type:             "evidence",
		PlayerID:         e.PlayerID,
		PlayerName:       e.PlayerName,
		TeamID:           e.TeamID,
		Side:             e.Side,
		Location:         e.Location,
		Description:      e.Description,
		RelatedPlayerIDs: []string{e.PlayerID},
		Impact:           e.Issue,
	})
}

func (s *parserState) addBombEvent(kind string, description string, player *common.Player, site string) {
	if s.isWarmup() || !s.roundActive {
		return
	}
	number := s.currentRound
	playerID, playerName, teamID := s.playerIdentity(player)
	location := "site " + site
	event := eventInfo{
		ID:               fmt.Sprintf("r%d_bomb_%d", number, len(s.events)+1),
		Round:            number,
		Time:             s.roundClock(),
		Type:             kind,
		PlayerID:         playerID,
		PlayerName:       playerName,
		TeamID:           teamID,
		Side:             sideFromPlayer(player),
		Location:         location,
		Description:      fmt.Sprintf("%s by %s at %s", description, fallbackName(playerName, "unknown"), location),
		RelatedPlayerIDs: []string{},
		Impact:           "c4",
	}
	s.addEvent(number, event)
	if strings.Contains(description, "planted") {
		s.plantedAt = s.parser.CurrentTime()
		s.roundPostPlantTeam = teamID
		if s.roundPostPlantTeam == "" || s.roundPostPlantTeam == "unknown" {
			s.roundPostPlantTeam = s.teamIDForSide(common.TeamTerrorists)
		}
		if (s.roundPostPlantTeam == "team_a" && s.aliveT > s.aliveCT) || (s.roundPostPlantTeam == "team_b" && s.aliveCT > s.aliveT) {
			s.roundPostPlantAdvantage = true
		}
		if s.roundClockSeconds() >= 90 && player != nil && (teamID == "team_a" || teamID == "team_b") {
			if idx, ok := s.roundIndex[number]; ok {
				s.rounds[idx].Tags = appendUnique(s.rounds[idx].Tags, "late_execute")
			}
			s.addEvidence(evidenceInfo{
				ID:          fmt.Sprintf("ev_r%d_late_execute_%s", number, playerID),
				PlayerID:    playerID,
				PlayerName:  playerName,
				TeamID:      teamID,
				Round:       number,
				Time:        s.roundClock(),
				Location:    location,
				Issue:       "late_execute",
				Label:       "下包/执行时间偏晚",
				Event:       "90 秒后才下包",
				Description: fmt.Sprintf("%s 在回合开始 %.0f 秒后完成下包；这是时间线事实，是否因决策问题需要结合完整事件复盘。", fallbackName(playerName, "Player"), s.roundClockSeconds()),
				Side:        "T",
				Severity:    0.48,
			})
		}
		for _, p := range s.parser.GameState().Participants().Playing() {
			if !isTrackedPlayer(p) || !p.IsAlive() {
				continue
			}
			st := s.ensureStats(p)
			if st.teamID == s.roundPostPlantTeam {
				s.roundPostPlantPlayers[p.SteamID64] = true
			}
			if p.Team == common.TeamCounterTerrorists {
			}
		}
	}
}

func (s *parserState) addGrenadeEvent(kind string, description string, grenade events.GrenadeEvent) {
	if s.isWarmup() || !s.roundActive {
		return
	}
	number := s.currentRound
	playerID, playerName, teamID := s.playerIdentity(grenade.Thrower)
	location := vectorLocation(grenade.Position)
	event := eventInfo{
		ID:               fmt.Sprintf("r%d_utility_%d", number, len(s.events)+1),
		Round:            number,
		Time:             s.roundClock(),
		Type:             "utility",
		PlayerID:         playerID,
		PlayerName:       playerName,
		TeamID:           teamID,
		Side:             sideFromPlayer(grenade.Thrower),
		Location:         location,
		Description:      fmt.Sprintf("%s by %s at %s", description, fallbackName(playerName, "unknown"), location),
		RelatedPlayerIDs: []string{},
		Impact:           kind,
	}
	s.addEvent(number, event)
}

func (s *parserState) addFlashResult(e events.PlayerFlashed) {
	if s.isWarmup() || !s.roundActive {
		return
	}
	if e.Attacker == nil || e.Player == nil {
		return
	}
	number := s.currentRound
	attackerID, attackerName, attackerTeam := s.playerIdentity(e.Attacker)
	playerID, playerName, _ := s.playerIdentity(e.Player)
	location := playerLocation(e.Player)
	duration := e.FlashDuration().Seconds()
	selfFlash := e.Attacker.SteamID64 == e.Player.SteamID64
	teamFlash := !selfFlash && e.Attacker.Team == e.Player.Team
	st := s.ensureStats(e.Attacker)
	impact := "enemy_flashed"
	if selfFlash {
		impact = "self_flash"
	} else if teamFlash {
		if duration >= 0.5 {
			st.teammatesFlashed++
		}
		impact = "team_flash"
	} else if duration >= 0.5 {
		st.enemiesFlashed++
		s.roundUtilityImpact[e.Attacker.SteamID64] = true
	}
	event := eventInfo{
		ID:               fmt.Sprintf("r%d_flash_%d", number, len(s.events)+1),
		Round:            number,
		Time:             s.roundClock(),
		Type:             "utility",
		PlayerID:         attackerID,
		PlayerName:       attackerName,
		TeamID:           attackerTeam,
		Side:             sideFromPlayer(e.Attacker),
		Location:         location,
		Description:      fmt.Sprintf("%s flashed %s for %.1fs at %s", fallbackName(attackerName, "Unknown"), fallbackName(playerName, "Unknown"), duration, location),
		RelatedPlayerIDs: []string{playerID},
		Impact:           impact,
	}
	s.addEvent(number, event)
	if !selfFlash && !teamFlash && duration >= 0.5 {
		s.roundUtilityImpact[e.Attacker.SteamID64] = true
	}
	if teamFlash && duration >= 1.5 {
		s.addEvidence(evidenceInfo{
			ID:          fmt.Sprintf("ev_r%d_team_flash_%s_%s", number, attackerID, playerID),
			PlayerID:    attackerID,
			PlayerName:  attackerName,
			TeamID:      attackerTeam,
			Round:       number,
			Time:        event.Time,
			Location:    location,
			Issue:       "team_flash",
			Label:       "闪到队友",
			Event:       "team flash",
			Description: fmt.Sprintf("%s 在 %s 把队友 %s 闪了 %.1f 秒。", fallbackName(attackerName, "Player"), location, fallbackName(playerName, "teammate"), duration),
			Side:        sideFromPlayer(e.Attacker),
			Severity:    0.68,
		})
	}
}

func (s *parserState) updateKillStats(e events.Kill, opening bool) {
	enemyKill := isEnemyKill(e)
	if enemyKill && e.Killer != nil {
		st := s.ensureStats(e.Killer)
		st.kills++
		s.roundKill[e.Killer.SteamID64] = true
		if opening {
			st.openingAttempts++
			st.openingWins++
		}
	}
	if e.Victim != nil {
		st := s.ensureStats(e.Victim)
		st.deaths++
		s.roundDied[e.Victim.SteamID64] = true
		if opening {
			st.openingAttempts++
			st.firstDeaths++
		}
	}
	if enemyKill && e.Assister != nil && e.Assister != e.Killer && e.Assister.Team == e.Killer.Team {
		s.ensureStats(e.Assister).assists++
		s.roundAssist[e.Assister.SteamID64] = true
		if e.AssistedFlash {
			s.ensureStats(e.Assister).flashAssists++
			s.roundUtilityImpact[e.Assister.SteamID64] = true
		}
	}
}

// recordTrade classifies a kill as a trade when the killer avenges a teammate
// who was killed by this victim within the trade window, then remembers the
// kill so it can be traded in turn.
func (s *parserState) recordTrade(e events.Kill) bool {
	if e.Killer == nil || e.Victim == nil {
		return false
	}
	now := s.parser.CurrentTime()
	traded := false
	killerTeam := s.ensureStats(e.Killer).teamID
	for i := len(s.recentKills) - 1; i >= 0; i-- {
		rk := s.recentKills[i]
		if now-rk.time > tradeWindow {
			break
		}
		if rk.killerSteam == e.Victim.SteamID64 && rk.victimTeamID == killerTeam {
			killerSt := s.ensureStats(e.Killer)
			killerSt.tradeKills++
			killerSt.tradeTimeSum += (now - rk.time).Seconds()
			if victimSt, ok := s.stats[rk.victimSteam]; ok {
				victimSt.tradedDeaths++
			}
			s.roundTraded[rk.victimSteam] = true
			traded = true
			break
		}
	}
	s.recentKills = append(s.recentKills, killRecord{
		killerSteam:  e.Killer.SteamID64,
		victimSteam:  e.Victim.SteamID64,
		victimTeamID: s.ensureStats(e.Victim).teamID,
		time:         now,
	})
	return traded
}

// recordKAST credits each player still in the round with a KAST round when they
// got a kill or assist, survived, or had their death traded.
func (s *parserState) recordKAST() {
	for sid := range s.roundParticipants {
		st, ok := s.stats[sid]
		if !ok {
			continue
		}
		st.roundsPlayed++
		if s.roundUtilityImpact[sid] {
			st.utilityImpactRounds++
		}
		if s.roundKill[sid] || s.roundAssist[sid] || !s.roundDied[sid] || s.roundTraded[sid] {
			st.kastRounds++
		}
	}
}

func (s *parserState) resetRoundTracking() {
	s.recentKills = s.recentKills[:0]
	s.roundKill = map[uint64]bool{}
	s.roundAssist = map[uint64]bool{}
	s.roundDied = map[uint64]bool{}
	s.roundTraded = map[uint64]bool{}
	s.roundUtilityImpact = map[uint64]bool{}
	s.roundParticipants = map[uint64]bool{}
	s.roundClutchCandidates = map[uint64]string{}
	s.roundPostPlantTeam = ""
	s.roundPostPlantPlayers = map[uint64]bool{}
	s.roundPostPlantDied = map[uint64]bool{}
	s.roundPostPlantDeaths = s.roundPostPlantDeaths[:0]
	s.roundPostPlantAdvantage = false
	s.plantedAt = 0
	s.aliveT = 0
	s.aliveCT = 0
	s.hadBigLead = false
	s.leadSide = ""
	s.roundDeaths = s.roundDeaths[:0]
}

func (s *parserState) beginRoundSnapshot() {
	s.roundStatsSnapshot = cloneStats(s.stats)
	s.roundDeathPlacesSnapshot = cloneDeathPlaces(s.deathPlaces)
	s.roundEvidenceStart = len(s.evidence)
	s.roundEventsStart = len(s.events)
}

func (s *parserState) clearRoundSnapshot() {
	s.roundStatsSnapshot = nil
	s.roundDeathPlacesSnapshot = nil
	s.roundEvidenceStart = 0
	s.roundEventsStart = 0
}

func (s *parserState) discardOpenRound() {
	if s.roundStatsSnapshot != nil {
		s.stats = cloneStats(s.roundStatsSnapshot)
		s.deathPlaces = cloneDeathPlaces(s.roundDeathPlacesSnapshot)
	}
	if s.roundEvidenceStart >= 0 && s.roundEvidenceStart <= len(s.evidence) {
		s.evidence = s.evidence[:s.roundEvidenceStart]
	}
	if s.roundEventsStart >= 0 && s.roundEventsStart <= len(s.events) {
		s.events = s.events[:s.roundEventsStart]
	}
	if idx, ok := s.roundIndex[s.currentRound]; ok {
		s.rounds = append(s.rounds[:idx], s.rounds[idx+1:]...)
		s.rebuildRoundIndex()
	}
	delete(s.roundKills, s.currentRound)
	s.roundActive = false
	s.clearRoundSnapshot()
}

func (s *parserState) rebuildRoundIndex() {
	s.roundIndex = map[int]int{}
	for i, round := range s.rounds {
		s.roundIndex[round.Number] = i
	}
}

func (s *parserState) resetMatchData() {
	s.currentRound = 0
	s.score = scoreInfo{}
	s.rounds = nil
	s.roundIndex = map[int]int{}
	s.events = nil
	s.evidence = nil
	s.stats = map[uint64]*playerStats{}
	s.teams = map[string]string{"team_a": "Team A", "team_b": "Team B"}
	s.roundKills = map[int]int{}
	s.deathPlaces = map[uint64]map[string]int{}
	s.teamsFrozen = false
	s.roundActive = false
	s.matchStartTime = 0
	s.matchEndTime = 0
	s.lastPositionSample = 0
	s.resetRoundTracking()
	s.clearRoundSnapshot()
}

func cloneStats(source map[uint64]*playerStats) map[uint64]*playerStats {
	out := make(map[uint64]*playerStats, len(source))
	for steamID, stats := range source {
		if stats == nil {
			continue
		}
		copyStats := *stats
		copyStats.locationCounts = cloneStringIntMap(stats.locationCounts)
		copyStats.deathLocationCounts = cloneStringIntMap(stats.deathLocationCounts)
		out[steamID] = &copyStats
	}
	return out
}

func cloneDeathPlaces(source map[uint64]map[string]int) map[uint64]map[string]int {
	out := make(map[uint64]map[string]int, len(source))
	for steamID, locations := range source {
		out[steamID] = cloneStringIntMap(locations)
	}
	return out
}

func cloneStringIntMap(source map[string]int) map[string]int {
	out := make(map[string]int, len(source))
	for key, value := range source {
		out[key] = value
	}
	return out
}

func (s *parserState) snapshotRoundParticipants() {
	for _, p := range s.parser.GameState().Participants().Playing() {
		if !isTrackedPlayer(p) {
			continue
		}
		s.ensureStats(p)
		s.roundParticipants[p.SteamID64] = true
	}
}

func (s *parserState) snapshotAliveCounts() {
	aliveT, aliveCT := 0, 0
	for _, p := range s.parser.GameState().Participants().Playing() {
		if !isTrackedPlayer(p) || !p.IsAlive() {
			continue
		}
		switch p.Team {
		case common.TeamTerrorists:
			aliveT++
		case common.TeamCounterTerrorists:
			aliveCT++
		}
	}
	s.aliveT, s.aliveCT = aliveT, aliveCT
}

func (s *parserState) updateAliveCounts(e events.Kill) {
	if e.Victim == nil {
		return
	}
	switch e.Victim.Team {
	case common.TeamTerrorists:
		if s.aliveT > 0 {
			s.aliveT--
		}
	case common.TeamCounterTerrorists:
		if s.aliveCT > 0 {
			s.aliveCT--
		}
	}
}

func (s *parserState) trackPostPlantDeath(e events.Kill) {
	if s.plantedAt == 0 || e.Victim == nil || !isEnemyKill(e) || !s.roundPostPlantPlayers[e.Victim.SteamID64] {
		return
	}
	s.roundPostPlantDied[e.Victim.SteamID64] = true
	if !s.roundPostPlantAdvantage {
		return
	}
	elapsed := s.parser.CurrentTime() - s.plantedAt
	if elapsed < 0 || elapsed > 8*time.Second {
		return
	}
	playerID, playerName, teamID := s.playerIdentity(e.Victim)
	s.roundPostPlantDeaths = append(s.roundPostPlantDeaths, deathRecord{
		steam:    e.Victim.SteamID64,
		playerID: playerID,
		name:     playerName,
		teamID:   teamID,
		location: playerLocation(e.Victim),
		side:     sideFromPlayer(e.Victim),
		clock:    s.roundClock(),
		at:       s.parser.CurrentTime(),
	})
}

func (s *parserState) roundClockSeconds() float64 {
	elapsed := s.parser.CurrentTime() - s.roundStartTime
	if elapsed < 0 {
		return 0
	}
	return elapsed.Seconds()
}

func (s *parserState) flushPostPlantEvidence(number int, winnerSide string) {
	if winnerSide != "CT" || !s.roundPostPlantAdvantage || len(s.roundPostPlantDeaths) == 0 {
		return
	}
	for i, death := range s.roundPostPlantDeaths {
		location := death.location
		if location == "" {
			location = "unknown"
		}
		elapsed := death.at - s.plantedAt
		s.addEvidence(evidenceInfo{
			ID:          fmt.Sprintf("ev_r%d_postplant_%s_%d", number, death.playerID, i+1),
			PlayerID:    death.playerID,
			PlayerName:  death.name,
			TeamID:      death.teamID,
			Round:       number,
			Time:        death.clock,
			Location:    location,
			Issue:       "post_plant_overpeek",
			Label:       "下包后过早死亡",
			Event:       "下包后 8 秒内死亡",
			Description: fmt.Sprintf("%s 在下包时人数领先，随后 %.1f 秒内于 %s 死亡；建议复盘是否离开了可交易站位。", fallbackName(death.name, "Player"), elapsed.Seconds(), location),
			Side:        death.side,
			Severity:    0.62,
		})
	}
	if idx, ok := s.roundIndex[number]; ok {
		s.rounds[idx].Tags = appendUnique(s.rounds[idx].Tags, "post_plant_failure")
	}
}

func (s *parserState) trackClutchCandidate() {
	if s.aliveT == 1 && s.aliveCT >= 1 {
		for _, p := range s.parser.GameState().Participants().Playing() {
			if isTrackedPlayer(p) && p.IsAlive() && p.Team == common.TeamTerrorists {
				s.roundClutchCandidates[p.SteamID64] = "team_a"
			}
		}
	}
	if s.aliveCT == 1 && s.aliveT >= 1 {
		for _, p := range s.parser.GameState().Participants().Playing() {
			if isTrackedPlayer(p) && p.IsAlive() && p.Team == common.TeamCounterTerrorists {
				s.roundClutchCandidates[p.SteamID64] = "team_b"
			}
		}
	}
}

func (s *parserState) finalizeAdvancedRoundStats(winnerID string) {
	for steamID, teamID := range s.roundClutchCandidates {
		if st, ok := s.stats[steamID]; ok {
			st.clutchAttempts++
			if teamID == winnerID {
				st.clutchWins++
			}
		}
	}
	if s.plantedAt == 0 || s.roundPostPlantTeam == "" {
		return
	}
	for steamID := range s.roundPostPlantPlayers {
		if st, ok := s.stats[steamID]; ok {
			st.postPlantRounds++
			if !s.roundPostPlantDied[steamID] {
				st.postPlantSurvivalRounds++
			}
		}
	}
}

func (s *parserState) maybeTrackAdvantage() {
	if s.hadBigLead {
		return
	}
	if s.aliveT-s.aliveCT >= 2 {
		s.hadBigLead = true
		s.leadSide = "T"
	} else if s.aliveCT-s.aliveT >= 2 {
		s.hadBigLead = true
		s.leadSide = "CT"
	}
}

func (s *parserState) nearestTeammateDistance(victim *common.Player) (float64, bool) {
	if victim == nil {
		return 0, false
	}
	victimPos := victim.Position()
	if victimPos.X == 0 && victimPos.Y == 0 && victimPos.Z == 0 {
		victimPos = victim.LastAlivePosition
	}
	if victimPos.X == 0 && victimPos.Y == 0 && victimPos.Z == 0 {
		return 0, false
	}
	best := math.MaxFloat64
	found := false
	for _, p := range s.parser.GameState().Participants().Playing() {
		if p == nil || p == victim || p.SteamID64 == victim.SteamID64 || p.Team != victim.Team {
			continue
		}
		if !p.IsAlive() {
			continue
		}
		pos := p.Position()
		if pos.X == 0 && pos.Y == 0 && pos.Z == 0 {
			continue
		}
		dx := pos.X - victimPos.X
		dy := pos.Y - victimPos.Y
		dz := pos.Z - victimPos.Z
		dist := math.Sqrt(dx*dx + dy*dy + dz*dz)
		if dist < best {
			best = dist
			found = true
		}
	}
	return best, found
}

func (s *parserState) flushDeathEvidence(number int) {
	for i, death := range s.roundDeaths {
		if s.roundTraded[death.steam] {
			continue
		}
		if !death.hasDist || death.dist <= tradeDistanceMax {
			continue
		}
		if !death.opening && death.teammatesAlive < 2 {
			continue
		}
		distText := fmt.Sprintf("%.0f units", death.dist)
		if death.opening {
			s.addEvidence(evidenceInfo{
				ID:          fmt.Sprintf("ev_r%d_first_death_%s", number, death.playerID),
				PlayerID:    death.playerID,
				PlayerName:  death.name,
				TeamID:      death.teamID,
				Round:       number,
				Time:        death.clock,
				Location:    death.location,
				Issue:       "solo_first_death",
				Label:       "默认阶段单走首死",
				Event:       "无补枪首死",
				Description: fmt.Sprintf("%s 在 %s 首死，最近队友约 %s，5 秒内无人补枪。", fallbackName(death.name, "Player"), death.location, distText),
				Side:        death.side,
				Severity:    0.8,
			})
			if idx, ok := s.roundIndex[number]; ok {
				s.rounds[idx].Tags = appendUnique(s.rounds[idx].Tags, "opening_death_swing")
			}
			continue
		}
		s.addEvidence(evidenceInfo{
			ID:          fmt.Sprintf("ev_r%d_trade_spacing_%s_%d", number, death.playerID, i+1),
			PlayerID:    death.playerID,
			PlayerName:  death.name,
			TeamID:      death.teamID,
			Round:       number,
			Time:        death.clock,
			Location:    death.location,
			Issue:       "trade_spacing_review",
			Label:       "无补枪距离",
			Event:       "死亡后 5 秒内没有交易",
			Description: fmt.Sprintf("%s 在 %s 死亡，最近队友约 %s，5 秒内没有被补枪。", fallbackName(death.name, "Player"), death.location, distText),
			Side:        death.side,
			Severity:    0.5,
		})
	}
}

func (s *parserState) maybeRepeatPeekEvidence(e events.Kill, number int, clock, location, victimID, victimName, victimTeam string) {
	if e.Victim == nil || location == "" || location == "unknown" {
		return
	}
	if s.deathPlaces[e.Victim.SteamID64] == nil {
		s.deathPlaces[e.Victim.SteamID64] = map[string]int{}
	}
	s.deathPlaces[e.Victim.SteamID64][location]++
	if st, ok := s.stats[e.Victim.SteamID64]; ok {
		st.deathLocationCounts[location]++
	}
	// 命名区域粒度较粗，至少第三次在同一区域死亡才形成一条
	// "重复死亡点位"证据，并且每个区域只发一次，避免证据刷屏。
	if s.deathPlaces[e.Victim.SteamID64][location] != 3 {
		return
	}
	s.addEvidence(evidenceInfo{
		ID:          fmt.Sprintf("ev_r%d_repeat_peek_%s_%d", number, victimID, s.roundKills[number]),
		PlayerID:    victimID,
		PlayerName:  victimName,
		TeamID:      victimTeam,
		Round:       number,
		Time:        clock,
		Location:    location,
		Issue:       "repeat_death_position",
		Label:       "重复死亡点位",
		Event:       "同点位重复死亡",
		Description: fmt.Sprintf("%s 在 %s 重复死亡（本场第 %d 次）；demo 能确认点位重复，但不能直接确认是同一角度 repeek。", fallbackName(victimName, "Player"), location, s.deathPlaces[e.Victim.SteamID64][location]),
		Side:        sideFromPlayer(e.Victim),
		Severity:    0.58,
	})
}

func (s *parserState) tagEconomyMismatch(idx int) {
	byTeam := map[string][]int{}
	playersByTeam := map[string][]*common.Player{}
	for _, p := range s.parser.GameState().Participants().Playing() {
		if !isTrackedPlayer(p) {
			continue
		}
		teamID := s.ensureStats(p).teamID
		if teamID != "team_a" && teamID != "team_b" {
			continue
		}
		byTeam[teamID] = append(byTeam[teamID], p.EquipmentValueRoundStart())
		playersByTeam[teamID] = append(playersByTeam[teamID], p)
	}
	for teamID, vals := range byTeam {
		if len(vals) < 3 {
			continue
		}
		sorted := append([]int(nil), vals...)
		sort.Ints(sorted)
		if sorted[len(sorted)-1]-sorted[0] < 2500 {
			continue
		}
		high, low := 0, 0
		for _, v := range sorted {
			if v >= 4000 {
				high++
			}
			if v <= 1500 {
				low++
			}
		}
		if high < 1 || low < 2 {
			continue
		}
		s.rounds[idx].Tags = appendUnique(s.rounds[idx].Tags, "economy_swing")
		var subject *common.Player
		for _, p := range playersByTeam[teamID] {
			if p.EquipmentValueRoundStart() >= 4000 {
				subject = p
				break
			}
		}
		if subject == nil {
			continue
		}
		playerID, playerName, _ := s.playerIdentity(subject)
		s.addEvidence(evidenceInfo{
			ID:          fmt.Sprintf("ev_r%d_eco_%s", s.rounds[idx].Number, playerID),
			PlayerID:    playerID,
			PlayerName:  playerName,
			TeamID:      teamID,
			Round:       s.rounds[idx].Number,
			Time:        "0:00",
			Location:    "freeze time",
			Issue:       "economy_mismatch",
			Label:       "经济决策不统一",
			Event:       "经济不同步",
			Description: fmt.Sprintf("%s 所在队伍本回合有人全起、至少两人接近 eco。", fallbackName(playerName, "Player")),
			Side:        s.rounds[idx].SideByTeam[teamID],
			Severity:    0.55,
		})
	}
}

func (s *parserState) ensureStats(p *common.Player) *playerStats {
	if p == nil {
		return &playerStats{locationCounts: map[string]int{}}
	}
	if p.SteamID64 == 0 {
		return &playerStats{name: p.Name, locationCounts: map[string]int{}}
	}
	st, ok := s.stats[p.SteamID64]
	if !ok {
		teamID := teamIDForPlayer(p)
		if s.teamsFrozen {
			if inferred := s.teamIDForSide(p.Team); inferred != "" {
				teamID = inferred
			}
		}
		st = &playerStats{
			name:                p.Name,
			steamID:             fmt.Sprintf("%d", p.SteamID64),
			teamID:              teamID,
			sideStart:           sideFromPlayer(p),
			locationCounts:      map[string]int{},
			deathLocationCounts: map[string]int{},
		}
		s.stats[p.SteamID64] = st
	}
	if p.Name != "" {
		st.name = p.Name
	}
	if !s.teamsFrozen && st.teamID != "team_a" && st.teamID != "team_b" {
		if assigned := teamIDForPlayer(p); assigned == "team_a" || assigned == "team_b" {
			st.teamID = assigned
			st.sideStart = sideFromPlayer(p)
		}
	}
	return st
}

func (s *parserState) capturePlayers() {
	for _, p := range s.parser.GameState().Participants().Playing() {
		if p == nil || p.IsBot || p.IsUnknown || p.SteamID64 == 0 {
			continue
		}
		if p.Team != common.TeamTerrorists && p.Team != common.TeamCounterTerrorists {
			continue
		}
		st := s.ensureStats(p)
		teamID := st.teamID
		if p.TeamState != nil && p.TeamState.ClanName() != "" {
			s.teams[teamID] = p.TeamState.ClanName()
		}
	}
	if !s.teamsFrozen && s.currentRound == 1 {
		counts := map[string]int{}
		for _, p := range s.parser.GameState().Participants().Playing() {
			if !isTrackedPlayer(p) {
				continue
			}
			teamID := s.ensureStats(p).teamID
			if teamID == "team_a" || teamID == "team_b" {
				counts[teamID]++
			}
		}
		if counts["team_a"] > 0 && counts["team_b"] > 0 {
			s.teamsFrozen = true
		}
	}
}

func (s *parserState) captureFinalStats() {
	for _, p := range s.parser.GameState().Participants().Playing() {
		if !isTrackedPlayer(p) || p.Entity == nil {
			continue
		}
		st := s.ensureStats(p)
		st.kills = p.Kills()
		st.deaths = p.Deaths()
		st.assists = p.Assists()
		if totalDamage := p.TotalDamage(); totalDamage > 0 || st.damage == 0 {
			st.damage = totalDamage
		}
		if utilityDamage := p.UtilityDamage(); utilityDamage > 0 || st.utilityDamage == 0 {
			st.utilityDamage = utilityDamage
		}
	}
}

func (s *parserState) players() []playerInfo {
	players := make([]playerInfo, 0, len(s.stats))
	for _, st := range s.stats {
		if st.steamID == "" || st.steamID == "0" || st.roundsPlayed == 0 {
			continue
		}
		if st.teamID != "team_a" && st.teamID != "team_b" {
			continue
		}
		deaths := max(1, st.deaths)
		played := max(1, st.roundsPlayed)
		openingRate := ratio(st.openingWins, max(1, st.openingAttempts))
		firstDeathRate := ratio(st.firstDeaths, played)
		players = append(players, playerInfo{
			ID:          playerID(st.steamID),
			Name:        fallbackName(st.name, "Unknown"),
			TeamID:      st.teamID,
			SteamID:     st.steamID,
			Profile:     profileFromStats(st, played),
			SideStart:   st.sideStart,
			PathSummary: topLocations(st.locationCounts, 5),
			Stats: map[string]any{
				"kills":                st.kills,
				"deaths":               st.deaths,
				"assists":              st.assists,
				"kd":                   roundFloat(float64(st.kills)/float64(deaths), 2),
				"adr":                  int(math.Round(float64(st.damage) / float64(played))),
				"kast":                 percent(ratio(st.kastRounds, played)),
				"openingDuelWinRate":   percent(openingRate),
				"firstDeathRate":       percent(firstDeathRate),
				"firstKillRate":        percent(ratio(st.openingWins, played)),
				"tradeKillRate":        percent(ratio(st.tradeKills, max(1, st.kills))),
				"tradedDeathRate":      percent(ratio(st.tradedDeaths, deaths)),
				"timeToTradeSeconds":   roundFloat(safeDiv(st.tradeTimeSum, st.tradeKills), 1),
				"clutchWinRate":        ratioPercentOrNA(st.clutchWins, st.clutchAttempts),
				"utilityEffectiveness": percent(ratio(st.utilityImpactRounds, played)),
				"utilityDamage":        st.utilityDamage,
				"flashAssists":         st.flashAssists,
				"enemiesFlashed":       st.enemiesFlashed,
				"teammatesFlashed":     st.teammatesFlashed,
				"postPlantSurvival":    ratioPercentOrNA(st.postPlantSurvivalRounds, st.postPlantRounds),
				"repeatDeathPositions": repeatDeaths(st.deathLocationCounts),
				"siteHoldSuccess":      "n/a",
				"rotateTimingSeconds":  "n/a",
			},
		})
	}
	sort.Slice(players, func(i, j int) bool {
		if players[i].TeamID == players[j].TeamID {
			return players[i].Name < players[j].Name
		}
		return players[i].TeamID < players[j].TeamID
	})
	return players
}

func (s *parserState) finalizeRounds() {
	kept := make([]roundInfo, 0, len(s.rounds))
	validNumbers := map[int]bool{}
	for _, round := range s.rounds {
		if round.WinnerTeamID == "" || round.Result == "" || round.Result == "in progress" {
			continue
		}
		if round.WinningSide == "" {
			round.WinningSide = round.SideByTeam[round.WinnerTeamID]
		}
		if round.EndReason == "" {
			round.EndReason = "unknown"
		}
		if round.Tags == nil {
			round.Tags = []string{}
		}
		round.Events = filterTimelineEvents(round.Events)
		kept = append(kept, round)
		validNumbers[round.Number] = true
	}
	s.rounds = kept
	s.roundIndex = map[int]int{}
	for i, round := range s.rounds {
		s.roundIndex[round.Number] = i
	}
	filtered := s.evidence[:0]
	for _, item := range s.evidence {
		if validNumbers[item.Round] {
			filtered = append(filtered, item)
		}
	}
	s.evidence = filtered
}

func (s *parserState) teamIDForSide(side common.Team) string {
	for _, p := range s.parser.GameState().Participants().Playing() {
		if !isTrackedPlayer(p) || p.Team != side {
			continue
		}
		if st, ok := s.stats[p.SteamID64]; ok && (st.teamID == "team_a" || st.teamID == "team_b") {
			return st.teamID
		}
	}
	return ""
}

func (s *parserState) currentSideByTeam() map[string]string {
	sideByTeam := map[string]string{
		"team_a": "unknown",
		"team_b": "unknown",
	}
	for _, p := range s.parser.GameState().Participants().Playing() {
		if !isTrackedPlayer(p) {
			continue
		}
		st := s.ensureStats(p)
		side := sideFromPlayer(p)
		if st.teamID == "team_a" || st.teamID == "team_b" {
			sideByTeam[st.teamID] = side
		}
	}
	if sideByTeam["team_a"] == "unknown" && sideByTeam["team_b"] == "unknown" {
		sideByTeam["team_a"] = "T"
		sideByTeam["team_b"] = "CT"
	}
	if sideByTeam["team_a"] == "unknown" && sideByTeam["team_b"] == "T" {
		sideByTeam["team_a"] = "CT"
	}
	if sideByTeam["team_a"] == "unknown" && sideByTeam["team_b"] == "CT" {
		sideByTeam["team_a"] = "T"
	}
	if sideByTeam["team_b"] == "unknown" && sideByTeam["team_a"] == "T" {
		sideByTeam["team_b"] = "CT"
	}
	if sideByTeam["team_b"] == "unknown" && sideByTeam["team_a"] == "CT" {
		sideByTeam["team_b"] = "T"
	}
	return sideByTeam
}

func currentEconomyType(gs dem.GameState) string {
	t := gs.TeamTerrorists()
	ct := gs.TeamCounterTerrorists()
	if t == nil || ct == nil {
		return "unknown"
	}
	tType := classifyTeamBuy(t.RoundStartEquipmentValue())
	ctType := classifyTeamBuy(ct.RoundStartEquipmentValue())
	if tType == ctType {
		return tType
	}
	return fmt.Sprintf("T %s / CT %s", tType, ctType)
}

func classifyTeamBuy(teamEquip int) string {
	switch {
	case teamEquip <= 0:
		return "unknown"
	case teamEquip < 6000:
		return "eco"
	case teamEquip < 14000:
		return "half buy"
	case teamEquip < 19000:
		return "force buy"
	default:
		return "full buy"
	}
}

func (s *parserState) currentEconomySnapshot() map[string]int {
	snapshot := map[string]int{
		"team_a": 0,
		"team_b": 0,
	}
	for _, p := range s.parser.GameState().Participants().Playing() {
		if !isTrackedPlayer(p) {
			continue
		}
		// Use the cached team id so equipment values stay with the same team
		// after the halftime side swap.
		teamID := s.ensureStats(p).teamID
		if teamID == "team_a" || teamID == "team_b" {
			snapshot[teamID] += p.EquipmentValueRoundStart()
		}
	}
	return snapshot
}

func isTrackedPlayer(p *common.Player) bool {
	return p != nil && !p.IsBot && !p.IsUnknown && p.SteamID64 != 0 &&
		(p.Team == common.TeamTerrorists || p.Team == common.TeamCounterTerrorists)
}

func isEnemyKill(e events.Kill) bool {
	return e.Killer != nil && e.Victim != nil && e.Killer != e.Victim &&
		e.Killer.SteamID64 != e.Victim.SteamID64 &&
		e.Killer.Team != e.Victim.Team &&
		(e.Killer.Team == common.TeamTerrorists || e.Killer.Team == common.TeamCounterTerrorists) &&
		(e.Victim.Team == common.TeamTerrorists || e.Victim.Team == common.TeamCounterTerrorists)
}

func roundHasEvidence(items []evidenceInfo, round int, issue string) bool {
	for _, item := range items {
		if item.Round == round && item.Issue == issue {
			return true
		}
	}
	return false
}

func teamIDFromWinner(team common.Team, sideByTeam map[string]string) string {
	side := sideName(team)
	if side == "unknown" {
		return ""
	}
	for teamID, teamSide := range sideByTeam {
		if teamSide == side {
			return teamID
		}
	}
	return ""
}

func teamIDForPlayer(p *common.Player) string {
	if p == nil {
		return ""
	}
	if p.Team == common.TeamTerrorists {
		return "team_a"
	}
	if p.Team == common.TeamCounterTerrorists {
		return "team_b"
	}
	return "unknown"
}

func sideName(team common.Team) string {
	switch team {
	case common.TeamTerrorists:
		return "T"
	case common.TeamCounterTerrorists:
		return "CT"
	default:
		return "unknown"
	}
}

func sideFromPlayer(p *common.Player) string {
	if p == nil {
		return "unknown"
	}
	return sideName(p.Team)
}

func (s *parserState) playerIdentity(p *common.Player) (string, string, string) {
	if p == nil {
		return "unknown", "Unknown", "unknown"
	}
	return playerID(fmt.Sprintf("%d", p.SteamID64)), fallbackName(p.Name, "Unknown"), s.ensureStats(p).teamID
}

func playerID(steamID string) string {
	if steamID == "" || steamID == "0" {
		return "p_unknown"
	}
	return "steam_" + steamID
}

func playerLocation(p *common.Player) string {
	if p == nil {
		return "unknown"
	}
	if place := strings.TrimSpace(p.LastPlaceName()); place != "" {
		return humanPlaceName(place)
	}
	return "unknown"
}

func humanPlaceName(place string) string {
	lower := strings.ToLower(place)
	switch {
	case strings.Contains(lower, "bombsitea") || strings.Contains(lower, "bomb a") || lower == "a site":
		return "A site"
	case strings.Contains(lower, "bombsiteb") || strings.Contains(lower, "bomb b") || lower == "b site":
		return "B site"
	case strings.Contains(lower, "tspawn") || strings.Contains(lower, "t spawn"):
		return "T spawn"
	case strings.Contains(lower, "ctspawn") || strings.Contains(lower, "ct spawn"):
		return "CT spawn"
	default:
		return place
	}
}

func vectorLocation(v r3.Vector) string {
	if v.X == 0 && v.Y == 0 && v.Z == 0 {
		return "unknown"
	}
	return fmt.Sprintf("%.0f,%.0f,%.0f", v.X, v.Y, v.Z)
}

func isUtilityWeapon(weapon *common.Equipment, weaponString string) bool {
	value := strings.ToLower(weaponString)
	if weapon != nil {
		value += " " + strings.ToLower(weapon.String())
	}
	return strings.Contains(value, "hegrenade") ||
		strings.Contains(value, "grenade") ||
		strings.Contains(value, "molotov") ||
		strings.Contains(value, "incendiary") ||
		strings.Contains(value, "flash") ||
		strings.Contains(value, "smoke")
}

func roundTime(t time.Duration) string {
	total := int(t.Seconds())
	if total < 0 {
		total = 0
	}
	return fmt.Sprintf("%d:%02d", total/60, total%60)
}

func normalizeMap(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.Contains(lower, "mirage"):
		return "Mirage"
	case strings.Contains(lower, "inferno"):
		return "Inferno"
	case strings.Contains(lower, "dust2") || strings.Contains(lower, "dust_2"):
		return "Dust2"
	case strings.Contains(lower, "ancient"):
		return "Ancient"
	case strings.Contains(lower, "nuke"):
		return "Nuke"
	case strings.Contains(lower, "anubis"):
		return "Anubis"
	case strings.Contains(lower, "vertigo"):
		return "Vertigo"
	case strings.Contains(lower, "overpass"):
		return "Overpass"
	case strings.Contains(lower, "train"):
		return "Train"
	case strings.Contains(lower, "office"):
		return "Office"
	case name == "":
		return "unknown"
	default:
		return name
	}
}

func isSupportedMap(name string) bool {
	switch normalizeMap(name) {
	case "Mirage", "Inferno", "Dust2", "Ancient", "Nuke", "Anubis", "Vertigo", "Overpass", "Train":
		return true
	default:
		return false
	}
}

func (s *parserState) durationMinutes(headerTime time.Duration) int {
	duration := time.Duration(0)
	if s.matchStartTime > 0 && s.matchEndTime >= s.matchStartTime {
		duration = s.matchEndTime - s.matchStartTime
	}
	if duration <= 0 {
		duration = headerTime
	}
	mins := int(math.Round(duration.Minutes()))
	if mins < 0 {
		return 0
	}
	return mins
}

func matchID(path string, sha string) string {
	if sha != "" {
		if len(sha) > 12 {
			sha = sha[:12]
		}
		return "match_" + sha
	}
	base := strings.TrimSuffix(strings.ReplaceAll(path, string(os.PathSeparator), "_"), ".dem")
	return "match_" + base
}

func scoreFromRounds(rounds []roundInfo) scoreInfo {
	score := scoreInfo{}
	for _, r := range rounds {
		if r.WinnerTeamID == "team_a" {
			score.TeamA++
		} else if r.WinnerTeamID == "team_b" {
			score.TeamB++
		}
	}
	return score
}

func sideWinRates(rounds []roundInfo) map[string]string {
	wins := map[string]int{"T": 0, "CT": 0}
	played := map[string]int{"T": 0, "CT": 0}
	for _, r := range rounds {
		for _, side := range r.SideByTeam {
			if side == "T" || side == "CT" {
				played[side]++
			}
		}
		if r.WinningSide == "T" || r.WinningSide == "CT" {
			wins[r.WinningSide]++
		}
	}
	return map[string]string{
		"T":  percent(ratio(wins["T"], max(1, played["T"]))),
		"CT": percent(ratio(wins["CT"], max(1, played["CT"]))),
	}
}

func profileFromStats(st *playerStats, played int) string {
	openingShare := ratio(st.openingAttempts, max(1, played))
	utilShare := ratio(st.utilityImpactRounds, max(1, played))
	tradeShare := ratio(st.tradeKills, max(1, st.kills))
	switch {
	case openingShare >= 0.35:
		return "aggressive opener"
	case tradeShare >= 0.3:
		return "trade rifler"
	case utilShare >= 0.35:
		return "utility support"
	case st.openingAttempts <= max(2, played/8):
		return "low-contact rifler"
	default:
		return "balanced rifler"
	}
}

func ratioPercentOrNA(value, total int) string {
	if total <= 0 {
		return "n/a"
	}
	return percent(ratio(value, total))
}

func repeatDeaths(counts map[string]int) int {
	repeat := 0
	for _, count := range counts {
		if count >= 2 {
			repeat += count - 1
		}
	}
	return repeat
}

func filterTimelineEvents(events []eventInfo) []eventInfo {
	filtered := make([]eventInfo, 0, len(events))
	for _, event := range events {
		switch event.Type {
		case "kill", "c4", "evidence":
			filtered = append(filtered, event)
		case "utility":
			if event.Impact == "team_flash" || event.Impact == "enemy_flashed" {
				filtered = append(filtered, event)
			}
		}
	}
	return filtered
}

func topLocations(counts map[string]int, limit int) []string {
	type item struct {
		location string
		count    int
	}
	items := make([]item, 0, len(counts))
	for location, count := range counts {
		items = append(items, item{location: location, count: count})
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].count == items[j].count {
			return items[i].location < items[j].location
		}
		return items[i].count > items[j].count
	})
	out := []string{}
	for i, item := range items {
		if i >= limit {
			break
		}
		out = append(out, item.location)
	}
	return out
}

func roundEndReason(reason events.RoundEndReason) string {
	switch reason {
	case events.RoundEndReasonTargetBombed:
		return "bomb exploded"
	case events.RoundEndReasonBombDefused:
		return "bomb defused"
	case events.RoundEndReasonCTWin:
		return "ct win"
	case events.RoundEndReasonTerroristsWin:
		return "terrorists win"
	case events.RoundEndReasonTargetSaved:
		return "time expired"
	case events.RoundEndReasonDraw:
		return "draw"
	default:
		return fmt.Sprintf("reason_%d", reason)
	}
}

func bombsiteName(site events.Bombsite) string {
	switch site {
	case events.BombsiteA:
		return "A"
	case events.BombsiteB:
		return "B"
	default:
		return "unknown"
	}
}

func percent(v float64) string {
	return fmt.Sprintf("%.0f%%", v*100)
}

func ratio(a int, b int) float64 {
	if b <= 0 {
		return 0
	}
	return float64(a) / float64(b)
}

func safeDiv(sum float64, count int) float64 {
	if count <= 0 {
		return 0
	}
	return sum / float64(count)
}

func roundFloat(v float64, places int) float64 {
	pow := math.Pow10(places)
	return math.Round(v*pow) / pow
}

func envInt64(name string) int64 {
	var v int64
	fmt.Sscanf(os.Getenv(name), "%d", &v)
	return v
}

func fallbackName(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func appendUnique(items []string, value string) []string {
	if hasTag(items, value) {
		return items
	}
	return append(items, value)
}

func hasTag(items []string, value string) bool {
	for _, item := range items {
		if item == value {
			return true
		}
	}
	return false
}

func max(a int, b int) int {
	if a > b {
		return a
	}
	return b
}
