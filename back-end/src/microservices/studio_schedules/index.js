require('dotenv').config({ path: '../../../.env' });

//Express config
const express = require('express');
const app = express();
app.use(express.json());

// JWT
const { jwtAuthentication } = require('../authentication/middleware');

// Cors
var cors = require('cors')
app.use(cors());

// Models
const Studio = require('../database/Studio');
const StudioSchedule = require('../database/StudioSchedule');
const Reservation = require('../database/Reservation');
const User = require('../database/User');

app.get('/studios/:studio_id/reservations', jwtAuthentication, async (req, res) => {
    const studio_id = parseInt(req.params.studio_id);
    const { all } = req.query;

    const user_id = req.user.id;

    // Verificar se o estúdio é válido
    const studio = await Studio.findByPk(studio_id);
    if (!studio) return res.status(400).json('Estúdio inválido');

    // Criar a solicitação de reserva
    try {
        const reservations = await Reservation.findAll({
            include: [
                {
                    model: StudioSchedule,
                    required: true,
                    include: [{
                        model: Studio,
                        required: true,
                        where: {
                            id: studio_id
                        }
                    }]
                },
                {
                    model: User,
                    required: !(all === 'true'),
                    where: {
                        id: user_id
                    }
                }
            ]
        });
        return res.status(200).json(reservations);
    } catch (error) {
        console.log(error);
        return res.status(500).json('Não foi possível consultar as reservas para este estúdio');
    }
});

app.delete('/studios/:studio_id/reservations/:reservation_id', jwtAuthentication, async (req, res) => {
    const studio_id = parseInt(req.params.studio_id);
    const reservation_id = parseInt(req.params.reservation_id);
    const user_id = req.user.id;

    // Verificar se o estúdio é válido
    const studio = await Studio.findByPk(studio_id);
    if (!studio) return res.status(400).json('Estúdio inválido');

    // Verificar se o a reserva eh válida
    const reservation = await Reservation.findByPk(reservation_id);
    if (!reservation) return res.status(400).json('Reserva inválida');

    if (reservation.user_id !== user_id) {
        return res.status(400).json('Somente o solicitante pode excluir a reserva');
    }
    try {
        reservation.destroy();
        return res.status(200).json('Reserva #' + reservation.id + ' excluída!');
    } catch (error) {
        console.log(error);
        return res.status(500).json('Erro ao recusar a reserva');
    }
});

app.put('/studios/:studio_id/reservations/:reservation_id/cancel', jwtAuthentication, async (req, res) => {
    const studio_id = parseInt(req.params.studio_id);
    const reservation_id = parseInt(req.params.reservation_id);
    const user_id = req.user.id;

    // Verificar se o estúdio é válido
    const studio = await Studio.findByPk(studio_id);
    if (!studio) return res.status(400).json('Estúdio inválido');

    // Verificar se o a reserva eh válida
    const reservation = await Reservation.findByPk(reservation_id);
    if (!reservation) return res.status(400).json('Reserva inválida');
    if (reservation.accepted !== 0) return res.status(400).json('Reserva já tratada');

    // Verificar se o usuário é o proprietário/locador do estúdio
    if (studio.user_id !== user_id) {
        return res.status(400).json('Somente o locador pode recusar a reserva');
    }

    // Criar a solicitação de reserva
    try {
        reservation.accepted = -1;
        reservation.save();
        return res.status(200).json('Reserva #' + reservation.id + ' recusada!');
    } catch (error) {
        console.log(error);
        return res.status(500).json('Erro ao recusar a reserva');
    }
});

app.put('/studios/:studio_id/reservations/:reservation_id/accept', jwtAuthentication, async (req, res) => {
    const studio_id = parseInt(req.params.studio_id);
    const reservation_id = parseInt(req.params.reservation_id);
    const user_id = req.user.id;

    // Verificar se o estúdio é válido
    const studio = await Studio.findByPk(studio_id);
    if (!studio) return res.status(400).json('Estúdio inválido');

    // Verificar se o a reserva eh válida
    const reservation = await Reservation.findByPk(reservation_id);
    if (!reservation) return res.status(400).json('Reserva inválida');
    if (reservation.accepted !== 0) return res.status(400).json('Reserva já tratada');

    // Verificar se o usuário é o proprietário/locador do estúdio
    if (studio.user_id !== user_id) {
        return res.status(400).json('Somente o locador pode aceitar a reserva');
    }

    // Criar a solicitação de reserva
    try {
        reservation.accepted = 1;
        reservation.save();
        return res.status(200).json('Reserva #' + reservation.id + ' aceita!');
    } catch (error) {
        console.log(error);
        return res.status(500).json('Erro ao recusar a reserva');
    }
});

app.post('/studios/:studio_id/reservations', jwtAuthentication, async (req, res) => {
    const studio_id = parseInt(req.params.studio_id);
    const user_id = req.user.id;
    const studio_schedule_id = parseInt(req.body.studio_schedule_id); // ID da reserva do estúdio

    // Verificar se o estúdio é válido
    const studio = await Studio.findByPk(studio_id);
    if (!studio) {
        return res.status(400).json('Estúdio inválido');
    }

    // Verificar se o usuário é o proprietário/locador do estúdio
    if (studio.user_id === user_id) {
        return res.status(400).json('O propetario não pode locar o propio estudio');
    }

      const existingReservation = await Reservation.findOne({
        where: {
            user_id,
            studio_schedule_id
        }
    });
    if (existingReservation) {
        return res.status(400).json('Já existe uma reserva para esta agenda de estúdio');
    }


    // Criar a solicitação de reserva
    try {
        const reservation = await Reservation.create({
            user_id,
            studio_schedule_id,
        });
        return res.status(200).json('Solicitação de reserva criada com sucesso!');
    } catch (error) {
        console.log(error);
        return res.status(500).json('Erro ao criar a solicitação de reserva');
    }
});

app.post('/studios/:studio_id/schedules', jwtAuthentication, async (req, res) => {
    const studio_id = req.params.studio_id;
    const user_id = req.user.id;

    const studio = await Studio.findByPk(studio_id);
    if (!studio) return res.json('Estúdio inválido', 400);
    if (studio.user_id !== user_id) return res.json('Não autorizado', 400);

    let dates = req.body.dates;
    if (!dates?.length) return res.json('É necessário selecionar pelo menos uma data');
    if (!req.body.minRentHours) return res.json('É necessário informar o mínimo de horas de locação');
    if ((req.body.availableFrom !== 0 && !req.body.availableFrom)) return res.json('É necessário informar o horário inicial de disponibilidade');
    if (!req.body.availableTo) return res.json('É necessário informar o horário final de disponibilidade');

    dates = dates.map(date => {
        let startingFrom = parseInt(req.body.availableFrom);
        let availableTo = parseInt(req.body.availableTo);
        let schedules = [];
        const minRentHours = parseInt(req.body.minRentHours);

        while (true) {
            schedules.push({
                date: new Date(date),
                hour_from: startingFrom,
                hour_to: startingFrom + minRentHours,
                studio_id: parseInt(studio_id)
            })
            startingFrom += minRentHours;
            if ((startingFrom + minRentHours) > availableTo) break;
        }
        return schedules;
    });

    for (let i = 0; i < dates.length; i++) {
        for (let j = 0; j < dates[i].length; j++) {
            try {
                const existingSchedule = await StudioSchedule.findOne({
                    where: dates[i][j]
                });
                if (!existingSchedule) await StudioSchedule.create(dates[i][j])
            } catch (error) {
                console.log(error);
                return res.status(400).json('Erro ao criar agenda para o estúdio');
            }
        }
    }

    return res.json('Agendas criadas com sucesso!', 200);
})

app.get('/studios/:studio_id/schedules', async (req, res) => {
    const studio_id = req.params.studio_id;

    const studio = await Studio.findByPk(studio_id);
    if (!studio) return res.json('Estúdio inválido', 400);

    const schedules = await StudioSchedule.findAll({
        where: {
            studio_id
        }
    });
    return res.send(schedules, 200);
});

app.post('/studios/:studio_id/schedules/delete_list', jwtAuthentication, async (req, res) => {
    const studio_id = parseInt(req.params.studio_id);
    const user_id = req.user.id;

    // Verificar se o estúdio é válido
    const studio = await Studio.findByPk(studio_id);
    if (!studio) return res.status(400).json('Estúdio inválido');
    if (studio.user_id !== user_id) return res.json('Não autorizado', 400);

    let scheduleIdList = req.body.schedule_id_list;
    if (!scheduleIdList || !scheduleIdList.length) 
        return res.json('É necessário informar no mínimo 1 reserva p/ exclusão').status(400);
    try {
        for (const scheduleId of scheduleIdList) {
            let schedule = await StudioSchedule.findByPk(scheduleId);
            if (schedule) schedule.destroy();
        }
    } catch (error) {
        return res.status(400).json('Erro ao excluir reserva(s)');
    }

    return res.status(200).json('Reserva(s) excluida(s) com sucesso!');
})

app.listen(8000, () => {
    console.log("Studio Schedules is running. Port 8000");
});