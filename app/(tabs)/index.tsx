
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  Keyboard
} from 'react-native';
import { getFirestore, collection, doc, setDoc, deleteDoc, updateDoc, writeBatch, query, orderBy, onSnapshot, serverTimestamp, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import { useCollection } from 'react-firebase-hooks/firestore';
import { app } from '@/lib/firebase';
import { FontAwesome5, MaterialCommunityIcons, AntDesign } from '@expo/vector-icons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// --- Tipos e Dados ---

type ActorType = "Aliado" | "Inimigo" | "Neutro" | "Ambiente";
type Tier = "S" | "A" | "B" | "C" | "D";

interface Status {
  id: string;
  name: string;
  duration: number;
}

interface Actor {
  id: string;
  name: string;
  tier: Tier;
  initiative: number;
  type: ActorType;
  hp: number;
  maxHp: number;
  notes: string;
  statuses: Status[];
  initiativeTimestamp: Timestamp | null;
}

interface LogEntry {
  id: string;
  message: string;
  timestamp: {
    seconds: number;
    nanoseconds: number;
  } | null;
}


// --- Componentes ---

function ActorCard({ actor, sessionId, addLogEntry }: { actor: Actor; sessionId: string; addLogEntry: (message: string) => Promise<void> }) {
  const firestore = getFirestore(app);
  const actorRef = useMemo(() => doc(firestore, `amazegame/${sessionId}/actors`, actor.id), [firestore, sessionId, actor.id]);

  const typeStyles: Record<ActorType, { bg: string; border: string; iconColor: string }> = {
    Aliado: { bg: '#164e3b', border: '#22c55e', iconColor: '#4ade80' },
    Inimigo: { bg: '#7f1d1d', border: '#ef4444', iconColor: '#f87171' },
    Neutro: { bg: '#374151', border: '#6b7280', iconColor: '#9ca3af' },
    Ambiente: { bg: '#78350f', border: '#f59e0b', iconColor: '#fbbf24' },
  };
  const styles = typeStyles[actor.type];
  const tiers: Tier[] = ['D', 'C', 'B', 'A', 'S'];

  const handleUpdate = useCallback(async (data: Partial<Actor>) => {
    const dataToUpdate: Partial<Actor> & { initiativeTimestamp?: any } = { ...data };
    if ('initiative' in dataToUpdate) {
      dataToUpdate.initiativeTimestamp = serverTimestamp();
    }
    await updateDoc(actorRef, dataToUpdate);
  }, [actorRef]);

  const handleRemove = () => {
    Alert.alert(
      "Remover Ator",
      `Tem certeza que deseja remover "${actor.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Remover", style: "destructive", onPress: async () => {
          await deleteDoc(actorRef);
          await addLogEntry(`Ator "${actor.name}" foi removido.`);
        }}
      ]
    );
  };

  const handleHpChange = (value: string, field: 'hp' | 'maxHp') => {
    const currentVal = field === 'hp' ? actor.hp : actor.maxHp;
    let finalValue = currentVal;

    if (value.startsWith('+') || value.startsWith('-')) {
        const relativeValue = parseInt(value, 10);
        finalValue = !isNaN(relativeValue) ? (currentVal || 0) + relativeValue : currentVal;
    } else {
        const absoluteValue = parseInt(value, 10);
        finalValue = isNaN(absoluteValue) ? currentVal : absoluteValue;
    }

    if (field === 'hp') {
       finalValue = Math.max(0, Math.min(finalValue, actor.maxHp));
       handleUpdate({ hp: finalValue });
    } else {
       finalValue = Math.max(0, finalValue);
       const updateData: Partial<Actor> = { maxHp: finalValue };
       if (actor.hp > finalValue) {
           updateData.hp = finalValue;
       }
       handleUpdate(updateData);
    }
  };


  const addStatus = async () => {
    const newStatus: Status = { id: `status_${Date.now()}`, name: 'Novo Status', duration: 10 };
    await handleUpdate({ statuses: [...actor.statuses, newStatus] });
    await addLogEntry(`Adicionado status a "${actor.name}".`);
  };
  
  const updateStatus = async (statusId: string, data: Partial<Status>) => {
    const newStatuses = actor.statuses.map(s =>
      s.id === statusId ? { ...s, ...data } : s
    );
    await handleUpdate({ statuses: newStatuses });
  };
  
  const removeStatus = async (statusId: string) => {
    await handleUpdate({ statuses: actor.statuses.filter(s => s.id !== statusId) });
  };

  const toggleType = () => {
    const types: ActorType[] = ["Neutro", "Aliado", "Inimigo", "Ambiente"];
    const currentIndex = types.indexOf(actor.type);
    const nextType = types[(currentIndex + 1) % types.length];
    handleUpdate({ type: nextType });
  };
  
  const cycleTier = () => {
    const currentIndex = tiers.indexOf(actor.tier);
    const nextTier = tiers[(currentIndex + 1) % tiers.length];
    handleUpdate({ tier: nextTier });
  }

  const getActorIcon = () => {
     switch(actor.type){
         case 'Aliado': return <FontAwesome5 name="shield-alt" size={20} color={styles.iconColor} />;
         case 'Inimigo': return <FontAwesome5 name="khanda" size={20} color={styles.iconColor} />;
         case 'Ambiente': return <FontAwesome5 name="mountain" size={18} color={styles.iconColor} />;
         case 'Neutro': return <FontAwesome5 name="dice-d20" size={20} color={styles.iconColor} />;
     }
  }

  return (
    <View style={[cardStyles.card, { backgroundColor: styles.bg, borderColor: styles.border }]}>
        {/* Header */}
        <View style={cardStyles.header}>
            <TextInput
                value={actor.name}
                onChangeText={(name) => handleUpdate({ name })}
                style={cardStyles.nameInput}
            />
            <TouchableOpacity onPress={handleRemove} style={cardStyles.removeButton}>
                <AntDesign name="close" size={20} color="#f87171" />
            </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={cardStyles.statsRow}>
            {/* Initiative */}
            <View style={cardStyles.statItem}>
                <Text style={cardStyles.statLabel}>Iniciativa</Text>
                <TextInput
                    defaultValue={String(actor.initiative)}
                    onEndEditing={(e) => handleUpdate({ initiative: parseInt(e.nativeEvent.text, 10) || 0 })}
                    keyboardType="numeric"
                    style={cardStyles.numericInput}
                    textAlign="center"
                />
            </View>
            {/* HP */}
            <View style={cardStyles.statItem}>
                 <FontAwesome5 name="heart" size={16} color="#ef4444" style={{marginRight: 5}}/>
                 <TextInput
                    defaultValue={String(actor.hp)}
                    onEndEditing={(e) => handleHpChange(e.nativeEvent.text, 'hp')}
                    keyboardType="numeric"
                    style={[cardStyles.numericInput, {width: 50}]}
                    textAlign="center"
                />
                <Text style={cardStyles.hpSeparator}>/</Text>
                <TextInput
                    defaultValue={String(actor.maxHp)}
                    onEndEditing={(e) => handleHpChange(e.nativeEvent.text, 'maxHp')}
                    keyboardType="numeric"
                     style={[cardStyles.numericInput, {width: 50}]}
                    textAlign="center"
                />
            </View>
        </View>

        {/* Second Row */}
        <View style={cardStyles.statsRow}>
             <View style={cardStyles.statItem}>
                <Text style={cardStyles.statLabel}>Tipo</Text>
                <TouchableOpacity onPress={toggleType} style={[cardStyles.cycleButton, {backgroundColor: styles.border}]}>
                    {getActorIcon()}
                </TouchableOpacity>
            </View>
             <View style={cardStyles.statItem}>
                <Text style={cardStyles.statLabel}>Classe</Text>
                <TouchableOpacity onPress={cycleTier} style={cardStyles.cycleButton}>
                    <Text style={cardStyles.tierText}>{actor.tier}</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Notes and Statuses */}
        <View style={cardStyles.notesContainer}>
             <TextInput
                value={actor.notes}
                onChangeText={(notes) => handleUpdate({ notes })}
                placeholder="Anotações..."
                placeholderTextColor="#9ca3af"
                style={cardStyles.notesInput}
            />
            <TouchableOpacity onPress={addStatus} style={cardStyles.addStatusButton}>
                <AntDesign name="pluscircleo" size={24} color="#4ade80" />
            </TouchableOpacity>
        </View>

        {/* Status List */}
        <View>
            {actor.statuses.map(status => (
                <View key={status.id} style={cardStyles.statusRow}>
                    <AntDesign name="tago" size={18} color="#facc15" />
                    <TextInput
                        value={status.name}
                        onChangeText={(name) => updateStatus(status.id, { name })}
                        style={cardStyles.statusNameInput}
                        placeholder="Status..."
                        placeholderTextColor="#9ca3af"
                    />
                    <TextInput
                        defaultValue={String(status.duration)}
                         onEndEditing={(e) => updateStatus(status.id, { duration: parseInt(e.nativeEvent.text, 10) || 0 })}
                        keyboardType="numeric"
                        style={cardStyles.statusDurationInput}
                    />
                    <TouchableOpacity onPress={() => removeStatus(status.id)}>
                        <AntDesign name="minuscircleo" size={18} color="#f87171" />
                    </TouchableOpacity>
                </View>
            ))}
        </View>
    </View>
  );
}

function HistoryLog({ sessionId }: { sessionId: string }) {
    const firestore = getFirestore(app);
    const logsCollectionRef = useMemo(() => collection(firestore, `amazegame/${sessionId}/logs`), [firestore, sessionId]);
    const [logsSnapshot, loadingLogs] = useCollection(query(logsCollectionRef, orderBy('timestamp', 'desc')));
    const logs = useMemo(() => logsSnapshot?.docs.map(doc => ({ ...doc.data(), id: doc.id }) as LogEntry) || [], [logsSnapshot]);
    const scrollViewRef = useRef<ScrollView>(null);

    return (
        <View style={historyStyles.card}>
            <Text style={historyStyles.title}>Histórico</Text>
            <ScrollView style={historyStyles.scrollArea} ref={scrollViewRef} onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
                {loadingLogs && <ActivityIndicator color="#fff"/>}
                {logs.map((log) => (
                    <Text key={log.id} style={historyStyles.logEntry}>
                        <Text style={historyStyles.logTimestamp}>[{log.timestamp ? format(log.timestamp.seconds * 1000, 'HH:mm:ss', { locale: ptBR }) : '--:--:--'}] </Text>
                        {log.message}
                    </Text>
                ))}
                 {!loadingLogs && logs.length === 0 && <Text style={historyStyles.emptyText}>Nenhuma rolagem ainda.</Text>}
            </ScrollView>
        </View>
    );
}

export default function AmazegameScreen() {
    const firestore = getFirestore(app);
    // For a real app, you'd persist this or get it from a deep link/route param
    const [sessionId] = useState<string>(() => `session_${Date.now()}`);
    const [actorCounter, setActorCounter] = useState(1);

    const actorsCollectionRef = useMemo(() => collection(firestore, `amazegame/${sessionId}/actors`), [firestore, sessionId]);
    const q = useMemo(() => query(actorsCollectionRef, orderBy('initiative', 'asc'), orderBy('initiativeTimestamp', 'asc')), [actorsCollectionRef]);
    const [actorsSnapshot, loadingActors, error] = useCollection(q);
    const actors = useMemo(() => actorsSnapshot?.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Actor[] || [], [actorsSnapshot]);

    const addLogEntry = useCallback(async (message: string) => {
        if (!sessionId) return;
        const logsRef = collection(firestore, `amazegame/${sessionId}/logs`);
        await addDoc(logsRef, { message, timestamp: serverTimestamp() });
    }, [firestore, sessionId]);

    const addActor = useCallback(async () => {
        const newActorName = `Novo Ator ${actorCounter}`;
        const newActorData: Omit<Actor, 'id' | 'initiativeTimestamp'> = {
            name: newActorName,
            tier: 'D',
            initiative: 0,
            type: 'Neutro',
            hp: 10,
            maxHp: 10,
            notes: '',
            statuses: [],
        };
        const actorsRef = collection(firestore, `amazegame/${sessionId}/actors`);
        const newDocRef = doc(actorsRef);
        await setDoc(newDocRef, { ...newActorData, id: newDocRef.id, initiativeTimestamp: serverTimestamp() });
        await addLogEntry(`Ator "${newActorName}" foi adicionado.`);
        setActorCounter(prev => prev + 1);
    }, [firestore, sessionId, actorCounter, addLogEntry]);

    const rollAllInitiatives = useCallback(async () => {
        if (!actors || actors.length === 0) return;
        await addLogEntry("Rolando iniciativas para todos...");
        const batch = writeBatch(firestore);
        const tierDice: Record<Tier, number> = { S: 4, A: 6, B: 8, C: 10, D: 12 };
        
        const logPromises = actors.map(actor => {
            const d = tierDice[actor.tier];
            const rolls = Array.from({ length: 3 }, () => Math.floor(Math.random() * d) + 1);
            const total = rolls.reduce((a, b) => a + b, 0);
            
            const actorRef = doc(firestore, `amazegame/${sessionId}/actors`, actor.id);
            batch.update(actorRef, { initiative: total, initiativeTimestamp: serverTimestamp() });
            
            return addLogEntry(`${actor.name} rolou 3d${d} (${rolls.join(' + ')}) = ${total}`);
        });
        
        await Promise.all(logPromises);
        await batch.commit();
    }, [actors, firestore, sessionId, addLogEntry]);

    const clearAll = () => {
       Alert.alert(
            "Limpar Sessão de Combate",
            "Esta ação removerá TODOS os atores e logs. Não pode ser desfeito.",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Limpar Tudo", style: "destructive", onPress: async () => {
                    await addLogEntry("Sessão de combate limpa.");
                    const batch = writeBatch(firestore);
                    actors.forEach(actor => {
                        const actorRef = doc(firestore, `amazegame/${sessionId}/actors`, actor.id);
                        batch.delete(actorRef);
                    });
                    await batch.commit();
                    // Note: Deleting subcollections like logs this way is tricky.
                    // For a real app, use a Firebase Function to clean up subcollections.
                }}
            ]
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.mainTitle}>Maze Tracker</Text>
            
            <View style={styles.controlsContainer}>
                <TouchableOpacity style={styles.controlButton} onPress={addActor}>
                    <AntDesign name="plus" size={20} color="#fff" />
                    <Text style={styles.controlButtonText}>Ator</Text>
                </TouchableOpacity>
                 <TouchableOpacity style={styles.controlButton} onPress={rollAllInitiatives}>
                    <FontAwesome5 name="dice" size={20} color="#fff" />
                    <Text style={styles.controlButtonText}>Rolar Todos</Text>
                </TouchableOpacity>
                 <TouchableOpacity style={[styles.controlButton, styles.destructiveButton]} onPress={clearAll}>
                    <AntDesign name="delete" size={20} color="#fff" />
                    <Text style={styles.controlButtonText}>Limpar</Text>
                </TouchableOpacity>
            </View>

            {loadingActors ? (
              <ActivityIndicator size="large" color="#fff" style={{flex: 1}}/>
            ) : error ? (
              <Text style={styles.errorText}>Erro ao carregar Atores: {error.message}</Text>
            ) : (
              <FlatList
                data={actors}
                renderItem={({ item }) => <ActorCard actor={item} sessionId={sessionId} addLogEntry={addLogEntry} />}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                ListEmptyComponent={() => (
                    <View style={styles.emptyListContainer}>
                        <Text style={styles.emptyListText}>Nenhum ator em combate.</Text>
                        <Text style={styles.emptyListText}>Clique em "+ Ator" para começar.</Text>
                    </View>
                )}
              />
            )}
            
            <HistoryLog sessionId={sessionId} />
        </View>
    );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827', // cool-gray-900
    padding: 10,
    paddingTop: 40,
  },
  mainTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
    fontFamily: 'sans-serif-condensed'
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6', // blue-500
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  controlButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
   destructiveButton: {
    backgroundColor: '#ef4444', // red-500
  },
  listContent: {
      paddingBottom: 10,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    margin: 20
  },
  emptyListContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
  },
  emptyListText: {
      color: '#9ca3af',
      fontSize: 16,
  }
});

const cardStyles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    nameInput: {
        flex: 1,
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        borderBottomWidth: 1,
        borderColor: '#4b5563',
        paddingBottom: 4,
    },
    removeButton: {
        marginLeft: 10,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statLabel: {
        color: '#d1d5db',
        marginRight: 8,
        fontSize: 14,
    },
    numericInput: {
        color: '#fff',
        paddingVertical: 2,
        fontWeight: 'bold',
        fontSize: 16
    },
    hpSeparator: {
        color: '#fff',
        marginHorizontal: 2,
        fontSize: 16
    },
    cycleButton: {
        padding: 8,
        borderRadius: 6,
        minWidth: 40,
        alignItems: 'center',
        justifyContent: 'center'
    },
    tierText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    notesContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    notesInput: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
        color: '#fff',
        padding: 8,
        borderRadius: 6,
        fontSize: 14,
    },
    addStatusButton: {
        marginLeft: 10,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.2)',
        padding: 8,
        borderRadius: 6,
        marginTop: 6,
    },
    statusNameInput: {
        flex: 1,
        color: '#fff',
        marginHorizontal: 8,
    },
    statusDurationInput: {
        color: '#fff',
        width: 40,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 4,
        paddingVertical: 2
    }
});

const historyStyles = StyleSheet.create({
    card: {
        height: 200,
        backgroundColor: '#1f2937',
        borderRadius: 8,
        padding: 10,
        marginTop: 10,
    },
    title: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginBottom: 8,
    },
    scrollArea: {
        flex: 1,
    },
    logEntry: {
        color: '#d1d5db',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 12,
        marginBottom: 4,
    },
    logTimestamp: {
        color: '#6b7280',
    },
    emptyText: {
      color: '#6b7280',
      textAlign: 'center',
      marginTop: 20
    }
});
